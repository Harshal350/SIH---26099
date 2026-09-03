"""
Attribute extraction: Material DNA.
Converts unstructured descriptions into structured technical identity.
Extracts category-specific attributes using regex. Never invents attributes that
are not present (missing -> "Not provided").
"""

import re

UOM_ALIASES = {
    "EA": "EA", "EACH": "EA", "NOS": "NOS", "NO": "NOS", "NUMBER": "NOS",
    "SET": "SET", "KG": "KG", "MT": "MT", "M": "M", "METER": "M", "METRE": "M",
    "MM": "MM", "CM": "CM", "L": "L", "LTR": "L", "LITRE": "L", "LITERS": "L",
    "TON": "TON", "SQ M": "SQ M", "CU M": "CU M", "PAIR": "PAIR", "ROLL": "ROLL",
    "BOX": "BOX", "PKT": "PKT", "PCS": "PCS", "KIT": "KIT", "DRUM": "DRUM",
    "BUNDLE": "BUNDLE", "UNIT": "EA",
}

MATERIAL_MAP = {
    "SS": "STAINLESS STEEL", "STAINLESS STEEL": "STAINLESS STEEL",
    "MS": "MILD STEEL", "MILD STEEL": "MILD STEEL", "CARBON STEEL": "CARBON STEEL",
    "CS": "CARBON STEEL", "GI": "GALVANIZED IRON", "CI": "CAST IRON",
    "BRASS": "BRASS", "BRONZE": "BRONZE", "AL": "ALUMINIUM", "ALUMINIUM": "ALUMINIUM",
    "COPPER": "COPPER", "PVC": "PVC", "PTFE": "PTFE", "TEFLON": "PTFE",
    "NITRILE": "NITRILE", "EPDM": "EPDM", "CAST IRON": "CAST IRON",
}

def _norm(s: str):
    return " ".join(s.upper().replace("/", " ").split())


def _fmt_num(s: str) -> str:
    """Format a numeric string without stripping meaningful trailing zeros."""
    try:
        return f"{float(s):g}"
    except ValueError:
        return s

def _find_unit(desc: str):
    m = re.search(r'\b(EA|EACH|NOS?|SET|KG|MT|METRE|METER|M|MM|CM|SQ\s?M|CU\s?M|PAIR|ROLL|LTR?|LITRE|TON|BOX|PKT|PCS|KIT|DRUM|BUNDLE)\b', desc)
    if m:
        return UOM_ALIASES.get(m.group(1).upper(), m.group(1).upper())
    return None

def _extract_diameter(desc: str):
    m = re.search(r'(?:DN|NB|NOM\s?BORE|DIAM)?\s?(\d{1,4})\s?(?:MM|mm)?\s?(?:DIA|DIAMETER|DIAM|NB|DN|Ø)?', desc)
    # Prefer explicit diameter pattern
    m2 = re.search(r'(?:DIA|DIAMETER|DIAM|Ø)[\s:]*(\d{1,4}(?:\.\d+)?)[\s]*(MM)?', desc)
    m3 = re.search(r'(?:DN|NB)\s*(\d{1,4})', desc)
    m4 = re.search(r'M(\d{1,3})(?:X|\s*[xX]\s*)', desc)
    if m2:
        return f"{_fmt_num(m2.group(1))} {m2.group(2) or 'MM'}"
    if m3:
        return f"{_fmt_num(m3.group(1))} MM"
    if m4:
        return f"{_fmt_num(m4.group(1))} MM"
    return None

def _extract_length(desc: str):
    m = re.search(r'(?:LEN|LENGTH|L)[\s:]*(\d{1,4}(?:\.\d+)?)\s*(MM|CM|M|FT|IN)?', desc)
    m2 = re.search(r'(?:X|x)\s*(\d{1,4}(?:\.\d+)?)\s*(MM|CM|M)?', desc)
    if m2:
        return f"{_fmt_num(m2.group(1))} {m2.group(2) or 'MM'}"
    return None


def _extract_grade(desc: str):
    patterns = [
        r'\b(SS304|304L|304|SS316|316L|316|SS410|410|SS202|202|SS430|430)\b',
        r'\b(IS2062|IS2062\s?E250|E250|E350|IS1239|IS3589|IS800)\b',
        r'\b(ASTM\s?A106\s?Gr\.?\s?B|A106\s?Gr\.?B|A53\s?Gr\.?B)\b',
        r'\b(GRADE\s?\s?(\d+|[A-Z]+))',
        r'\b(PN\s?(\d+))',
        r'\b(sch|SCH)\s?(20|40|80|160|XXS|XS|STD)\b',
    ]
    for pat in patterns:
        m = re.search(pat, desc)
        if m:
            return m.group(0).upper()
    return None

def _extract_pressure(desc: str):
    m = re.search(r'(?:PN|PRESSURE|CLASS)[\s:]*(\d{1,4})', desc)
    if m:
        return f"PN {m.group(1)}"
    m = re.search(r'\b(CLASS|CL)\s?(150|300|600|900|1500|2500)\b', desc)
    if m:
        return f"CLASS {m.group(2)}"
    return None

def _extract_size(desc: str):
    m = re.search(r'(?:SIZE|SIZ)[\s:]*(\d{1,4}(?:\.\d+)?)\s*(MM|CM|IN|INCH)?', desc)
    return None  # size handled per category below

def _match_category(desc: str):
    d = desc.upper()
    if re.search(r'\b(BOLT|SCREW|NUT|WASHER|STUD|FASTENER)\b', d):
        return "FASTENER"
    if re.search(r'\b(VALVE|GATE|GLOBE|BALL|BUTTERFLY|CHECK|NON-RETURN)\b', d):
        return "VALVE"
    if re.search(r'\b(PUMP)\b', d):
        return "PUMP"
    if re.search(r'\b(BEARING)\b', d):
        return "BEARING"
    if re.search(r'\b(MOTOR)\b', d):
        return "MOTOR"
    if re.search(r'\b(CABLE|WIRE|CONDUCTOR)\b', d):
        return "ELECTRICAL"
    if re.search(r'\b(TRANSFORMER)\b', d):
        return "ELECTRICAL"
    if re.search(r'\b(GASKET)\b', d):
        return "GASKET"
    if re.search(r'\b(FLANGE)\b', d):
        return "FLANGE"
    if re.search(r'\b(PIPE|TUBE|TUBING)\b', d):
        return "PIPE"
    if re.search(r'\b(STEEL|PLATE|SHEET|BAR|ANGLE|CHANNEL|BEAM|WIRE\s?ROD)\b', d):
        return "STEEL"
    if re.search(r'\b(COMPRESSOR)\b', d):
        return "COMPRESSOR"
    if re.search(r'\b(HOSE)\b', d):
        return "HOSE"
    if re.search(r'\b(FILTER)\b', d):
        return "FILTER"
    if re.search(r'\b(SWITCH|BREAKER|CONTACTOR|RELAY)\b', d):
        return "ELECTRICAL"
    if re.search(r'\b(OIL|LUBRICANT|GREASE)\b', d):
        return "LUBRICANT"
    return "GENERAL"

def _fastener_attrs(desc):
    d = _norm(desc)
    attrs = {}
    m = re.search(r'M(\d{1,3})\s*(?:[Xx]|\*)', d)
    if m:
        attrs["grid_diameter"] = f"{m.group(1)} MM"
    m = re.search(r'\b(HEX|SOCKET|CARRIAGE|EYE|HOOK|ANCHOR|FLANGE)\s*HEAD\b', d)
    if m:
        attrs["head_type"] = m.group(1).title() + " Head"
    if re.search(r'\b(HEX)\b', d):
        attrs["type"] = "HEX BOLT"
    elif re.search(r'\b(STUD)\b', d):
        attrs["type"] = "STUD"
    elif re.search(r'\b(NUT)\b', d):
        attrs["type"] = "NUT"
    elif re.search(r'\b(WASHER)\b', d):
        attrs["type"] = "WASHER"
    elif re.search(r'\b(SCREW)\b', d):
        attrs["type"] = "SCREW"
    elif re.search(r'\b(BOLT)\b', d):
        attrs["type"] = "BOLT"
    m = re.search(r'(\d{2,4})\s*(?:MM|mm)?\s*(?:LONG|LG|LENGTH|L)?', d)
    return attrs

def extract_dna(description: str) -> dict:
    desc = description or ""
    d = _norm(desc)
    dna = {"category": _match_category(desc)}

    # material
    mat = None
    for token in sorted(MATERIAL_MAP, key=len, reverse=True):
        if re.search(r'\b' + re.escape(token) + r'\b', d):
            mat = MATERIAL_MAP[token]
            break
    dna["material"] = mat

    dna["grade"] = _extract_grade(desc)
    dna["diameter"] = _extract_diameter(desc)
    dna["length"] = _extract_length(desc)

    cat = dna["category"]
    if cat == "FASTENER":
        fa = _fastener_attrs(desc)
        dna["type"] = fa.get("type")
        dna["head_type"] = fa.get("head_type")
        if not dna["diameter"]:
            dna["diameter"] = fa.get("grid_diameter")
    elif cat == "VALVE":
        m = re.search(r'\b(GATE|GLOBE|BALL|BUTTERFLY|CHECK|NON-RETURN|GLOBE)\b', d)
        if m:
            dna["type"] = m.group(1).title() + " Valve"
        dna["pressure_rating"] = _extract_pressure(desc)
        if not dna["diameter"]:
            m = re.search(r'(?:DN|NB)\s*(\d{1,4})', d)
            if m:
                dna["diameter"] = f"{m.group(1)} MM"
    elif cat == "BEARING":
        m = re.search(r'\b(SKF|6200|6201|6202|6203|6204|6205|6305|6310|NU|NJ|6000)\b', d)
        if m:
            dna["type"] = "Bearing " + m.group(0)
    elif cat == "PIPE":
        dna["pressure_rating"] = _extract_pressure(desc)
        m = re.search(r'\b(SEAMLESS|ERW|EFW|HDPE|PVC)\b', d)
        if m:
            dna["type"] = m.group(1).upper()
    elif cat == "GASKET":
        m = re.search(r'\b(SPIRAL WOUND|CAF|METALLIC|NON-ASBESTOS|FULL FACE)\b', d)
        if m:
            dna["type"] = m.group(1).title()
    elif cat == "ELECTRICAL":
        m = re.search(r'(\d+(?:\.\d+)?)\s*KV', d)
        if m:
            dna["voltage"] = m.group(1) + " KV"
        mn = re.search(r'(\d+(?:\.\d+)?)\s*(?:SQ\s?MM|sqmm|mm²)\s*\d+\s*/\s*(\d+)', d)
        circumference = re.search(r'(\d+(?:\.\d+)?)\s*(?:SQ\s?MM|SQMM)', d)
        if circumference:
            dna["capacity"] = circumference.group(1) + " SQ MM"

    uom = _find_unit(desc)
    dna["uom"] = uom

    # Ensure missing critical fields are explicit (but not invented)
    for key in ("category", "type", "material", "grade", "diameter", "length", "capacity", "pressure_rating", "voltage"):
        if key not in dna or dna[key] is None:
            dna[key] = None

    return dna

def normalize_description(description: str) -> str:
    if not description:
        return ""
    d = _norm(description)
    # Expand common abbreviations for consistent matching
    for token, full in MATERIAL_MAP.items():
        if token in (full,):
            continue
        d = re.sub(r'\b' + re.escape(token) + r'\b', full, d)
    return " ".join(d.split())
