from dataclasses import asdict, dataclass
from ipaddress import ip_address
import unicodedata
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


SHORTENERS = {"bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rebrand.ly"}
BRANDS = {"google", "microsoft", "apple", "paypal", "amazon", "facebook", "instagram", "netflix", "bankofamerica", "chase", "coinbase"}
RISKY_SUFFIXES = (".exe", ".msi", ".scr", ".bat", ".cmd", ".ps1", ".vbs", ".js", ".jar", ".apk", ".dmg")
SUSPICIOUS_WORDS = {"verify", "credential", "signin", "password", "wallet", "authenticate", "recover", "billing", "payment"}
REDIRECT_KEYS = {"url", "redirect", "redirect_uri", "return", "returnto", "next", "continue", "dest", "destination", "target"}
CONFUSABLES = str.maketrans({
    "а": "a", "ɑ": "a", "α": "a", "в": "b", "β": "b", "с": "c", "ϲ": "c",
    "ԁ": "d", "е": "e", "ε": "e", "һ": "h", "н": "h", "і": "i", "ι": "i",
    "ј": "j", "κ": "k", "м": "m", "μ": "m", "ո": "n", "о": "o", "ο": "o",
    "р": "p", "ρ": "p", "զ": "q", "г": "r", "ѕ": "s", "т": "t", "τ": "t",
    "υ": "u", "ν": "v", "х": "x", "χ": "x", "у": "y",
})


@dataclass
class Finding:
    category: str
    severity: str
    evidence: str
    points: int


def _severity(points: int) -> str:
    if points >= 35:
        return "High"
    if points >= 20:
        return "Medium"
    return "Low"


def analyze_url(raw_url: str) -> dict:
    """Offline URL-string heuristics. Never makes a network request."""
    value = raw_url.strip()
    parsed = urlsplit(value)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Only absolute HTTP or HTTPS URLs can be analyzed")
    host = parsed.hostname.rstrip(".").lower()
    findings: list[Finding] = []

    def add(category: str, evidence: str, points: int):
        findings.append(Finding(category, _severity(points), evidence, points))

    try:
        ip_address(host.strip("[]"))
        add("ip-host", "The URL uses an IP address instead of a recognizable domain name.", 22)
    except ValueError:
        pass

    labels = host.split(".")
    display_labels = []
    for label in labels:
        try:
            display_labels.append(label.encode("ascii").decode("idna") if label.startswith("xn--") else label)
        except UnicodeError:
            display_labels.append(label)
    display_host = ".".join(display_labels)
    if any(label.startswith("xn--") for label in labels):
        add("idn-punycode", "The domain contains a Punycode label; verify the displayed Unicode spelling carefully.", 24)
    if any(ord(ch) > 127 for ch in display_host):
        add("unicode-domain", "The domain contains Unicode characters that may be visually confusable.", 20)
    has_mixed_label = any(
        len({
            "Cyrillic" if "CYRILLIC" in unicodedata.name(ch, "") else
            "Greek" if "GREEK" in unicodedata.name(ch, "") else
            "Latin" if "LATIN" in unicodedata.name(ch, "") else
            "Other"
            for ch in label if ch.isalpha()
        } - {"Other"}) > 1
        for label in display_labels
    )
    if has_mixed_label:
        add("mixed-script-domain", "The domain mixes writing systems, a common homograph warning sign.", 22)
    skeleton_labels = [
        "".join(ch for ch in unicodedata.normalize("NFKD", label.translate(CONFUSABLES)).casefold() if not unicodedata.combining(ch))
        for label in display_labels
    ]
    for label, skeleton in zip(display_labels, skeleton_labels):
        if label.casefold() != skeleton and skeleton in BRANDS:
            add("homograph-brand", f"The domain contains characters that visually resemble the brand name {skeleton!r}.", 40)
            break
    if parsed.username is not None or parsed.password is not None or "@" in parsed.netloc:
        add("userinfo-confusion", "The URL contains user-info syntax that can disguise the actual destination host.", 30)
    if len(labels) >= 5:
        add("deep-subdomain", "The hostname has many labels; confirm the registrable domain before trusting it.", 10)
    if host in SHORTENERS:
        add("url-shortener", "The URL uses a shortening service, so its final destination is not visible here.", 12)

    domain_stem = skeleton_labels[-2] if len(skeleton_labels) > 1 else skeleton_labels[0]
    compact_stem = "".join(ch for ch in domain_stem if ch.isalnum())
    for brand in BRANDS:
        if brand in compact_stem and compact_stem != brand:
            add("lookalike-brand", f"The domain label resembles the brand name {brand!r} but is not an exact match.", 24)
            break
        # Obvious single-character insertions, deletions and substitutions in brand labels.
        if len(compact_stem) in range(max(3, len(brand) - 1), len(brand) + 2) and compact_stem != brand:
            if _edit_distance_at_most_one(compact_stem, brand):
                add("lookalike-brand", f"The domain label is one character away from the brand name {brand!r}.", 22)
                break

    path_and_query = (parsed.path + " " + parsed.query).lower()
    matched_terms = sorted(word for word in SUSPICIOUS_WORDS if word in path_and_query)
    if len(matched_terms) >= 2:
        add("credential-language", "The path or query combines authentication/payment terms: " + ", ".join(matched_terms[:4]) + ".", 13)
    elif matched_terms:
        add("credential-language", "The path or query includes a sensitive account-related term: " + matched_terms[0] + ".", 7)

    redirect_keys = {key.lower() for key, _ in parse_qsl(parsed.query, keep_blank_values=True)} & REDIRECT_KEYS
    if redirect_keys:
        add("redirect-parameter", "The URL includes a destination-changing parameter: " + ", ".join(sorted(redirect_keys)) + ".", 10)
    if any(parsed.path.lower().endswith(suffix) for suffix in RISKY_SUFFIXES):
        add("executable-download", "The URL path ends in a file type commonly used for executable or script downloads.", 40)
    if len(value) > 250:
        add("long-url", "The URL is unusually long, which can obscure its destination or intent.", 7)
    if parsed.scheme.lower() == "http":
        add("insecure-transport", "The URL uses HTTP, so transport is not protected by HTTPS.", 5)

    score = min(100, sum(item.points for item in findings))
    if score >= 75:
        level = "Critical"
    elif score >= 50:
        level = "High"
    elif score >= 25:
        level = "Medium"
    elif score > 0:
        level = "Low"
    else:
        level = "Safe"
    confidence = round(min(0.94, 0.45 + 0.07 * len(findings)), 2) if findings else 0.55
    advice = ["Do not enter credentials or payment information until you independently verify the site.", "Check the registered domain and reach the service through a trusted bookmark or official app."] if score >= 25 else ["Treat this as an advisory URL-only check; confirm the site through a trusted source before sensitive actions."]
    return {
        "domain": host,
        "risk_level": level,
        "risk_score": score,
        "confidence": confidence,
        "evidence": [item.evidence for item in findings] or ["No suspicious URL patterns matched the local rule set."],
        "detections": [asdict(item) | {"points": item.points} for item in findings],
        "recommendations": advice,
    }


def redact_url(raw_url: str) -> str:
    """Keep useful URL structure while removing credentials, query values, and fragments."""
    parsed = urlsplit(raw_url.strip())
    netloc = parsed.netloc.rsplit("@", 1)[-1]
    query = urlencode([(key, "") for key, _ in parse_qsl(parsed.query, keep_blank_values=True)])
    return urlunsplit((parsed.scheme, netloc, parsed.path, query, ""))


def _edit_distance_at_most_one(a: str, b: str) -> bool:
    if a == b:
        return False
    if abs(len(a) - len(b)) > 1:
        return False
    i = j = edits = 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            i += 1
            j += 1
            continue
        edits += 1
        if edits > 1:
            return False
        if len(a) > len(b):
            i += 1
        elif len(b) > len(a):
            j += 1
        else:
            i += 1
            j += 1
    return edits + (i < len(a) or j < len(b)) <= 1
