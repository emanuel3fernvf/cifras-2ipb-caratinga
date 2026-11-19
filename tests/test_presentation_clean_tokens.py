import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PRESENTATION = ROOT / "assets/presentation-mode.js"


def _extract_function(source: str, name: str) -> str:
    start = source.index(f"  function {name}(")
    end = source.find("\n  function ", start + 1)
    if end == -1:
        end = source.find("\n  if (document.readyState", start + 1)
    return source[start:end]


def run_clean_helpers(payload):
    source = PRESENTATION.read_text(encoding="utf-8")
    chord_regex_line = next(
        line for line in source.splitlines() if line.strip().startswith("var CHORD_REGEX =")
    )
    helpers = [
        chord_regex_line.strip(),
        _extract_function(source, "stripInvisibleChars"),
        _extract_function(source, "isBlankLine"),
        _extract_function(source, "isChordLine"),
        _extract_function(source, "isBracketLine"),
        _extract_function(source, "getPresentationLyricLines"),
        _extract_function(source, "collectPresentationCleanItems"),
        _extract_function(source, "applyPresentationTokenChoices"),
        _extract_function(source, "applyPresentationCleanTokensToRaw"),
    ]
    script = "\n".join(
        [
            *helpers,
            f"const input = {json.dumps(payload, ensure_ascii=False)};",
            "const items = collectPresentationCleanItems(input.songs, input.saved || {});",
            "const changed = applyPresentationTokenChoices(input.line, input.corrections);",
            "const cleanedRaw = applyPresentationCleanTokensToRaw(input.preText || '', input.corrections);",
            "const corrections = {};",
            "items.forEach((item) => { if (item.useCorrected) corrections[item.source] = item.corrected; });",
            "process.stdout.write(JSON.stringify({ items, changed, cleanedRaw, corrections }));",
        ]
    )
    result = subprocess.run(
        ["node", "-e", script], check=True, capture_output=True, text=True
    )
    return json.loads(result.stdout)


def test_collects_deduplicates_and_premarks_saved_tokens():
    result = run_clean_helpers(
        {
            "songs": [
                {"preText": "Título\nC\nEspera----rei amá-lo Rei--, Alelu___ia!\nG\nEspera----rei Rei--"},
                {"preText": "C\nRei-- espera-rei-- Rei-_no"},
            ],
            "line": "Rei-- Rei--, espera-rei-- Rei-_no amá-lo",
            "corrections": {"Rei--": "Rei", "Rei-_no": "Reino"},
            "saved": {"Rei--": "Rei", "Alelu___ia!": "Aleluia!"},
        }
    )

    assert result["items"] == [
        {"source": "Espera----rei", "corrected": "Esperarei", "useCorrected": False},
        {"source": "amá-lo", "corrected": "amálo", "useCorrected": False},
        {"source": "Rei--,", "corrected": "Rei,", "useCorrected": False},
        {"source": "Alelu___ia!", "corrected": "Aleluia!", "useCorrected": True},
        {"source": "Rei--", "corrected": "Rei", "useCorrected": True},
        {"source": "espera-rei--", "corrected": "esperarei", "useCorrected": False},
        {"source": "Rei-_no", "corrected": "Reino", "useCorrected": False},
    ]
    assert result["changed"] == "Rei Rei--, espera-rei-- Reino amá-lo"
    assert result["corrections"] == {"Alelu___ia!": "Aleluia!", "Rei--": "Rei"}


def test_applies_corrections_only_on_lyric_lines_and_replaces_map():
    result = run_clean_helpers(
        {
            "songs": [],
            "line": "",
            "preText": "Cabeçalho\nC\n  Espera----rei   amá-lo  \nG7\n  Rei-_no  \n[ponte]\nRei--",
            "corrections": {"Espera----rei": "Esperarei", "Rei-_no": "Reino", "Rei--": "Rei"},
            "saved": {},
        }
    )

    assert result["cleanedRaw"] == (
        "Cabeçalho\nC\n  Esperarei   amá-lo  \nG7\n  Reino  \n[ponte]\nRei"
    )


def test_presentation_mode_wires_clean_flow_and_storage_key():
    source = PRESENTATION.read_text(encoding="utf-8")
    assert "catalog-presentation-clean-tokens:" in source
    assert "Limpar traços e underlines" in source
    assert "insertCleanControl" in source
    assert "applyPresentationCleanTokensToRaw(raw, loadCleanTokenCorrections())" in source
    assert "saveCleanTokenCorrections(corrections)" in source
