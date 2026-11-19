import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPORTERS = [
    ROOT / "assets/index-variant-1.js",
    ROOT / "assets/index-variant-5.js",
    ROOT / "assets/index-variant-6.js",
    ROOT / "assets/index-variant-7.js",
    ROOT / "assets/index-variant-8.js",
    ROOT / "assets/index-variant-9.js",
]


def run_review_helpers(payload):
    source = (ROOT / "assets/index-variant-1.js").read_text(encoding="utf-8")
    helpers = []
    for name in (
        "getHolyricsLyricLines",
        "stripHolyricsSeparators",
        "collapseHolyricsJunctionDuplicates",
        "collectHolyricsReviewItems",
        "applyHolyricsTokenChoices",
        "processPreTextForHolyrics",
    ):
        start = source.index(f"  function {name}(")
        end = source.find("\n  function ", start + 1)
        helpers.append(source[start:end])

    script = "\n".join(
        [
            "function isChordLine(line) { return /^\\s*[A-G](?:[#b])?(?:m|7)?\\s*$/.test(line); }",
            *helpers,
            f"const input = {json.dumps(payload, ensure_ascii=False)};",
            "const items = collectHolyricsReviewItems(input.songs);",
            "const changed = applyHolyricsTokenChoices(input.line, input.corrections);",
            "const modes = input.preText ? {",
            "  letra: processPreTextForHolyrics(input.preText, false, input.corrections),",
            "  cifra: processPreTextForHolyrics(input.preText, true, input.corrections)",
            "} : null;",
            "process.stdout.write(JSON.stringify({items, changed, modes}));",
        ]
    )
    result = subprocess.run(
        ["node", "-e", script], check=True, capture_output=True, text=True
    )
    return json.loads(result.stdout)


def test_collects_deduplicates_and_corrects_only_exact_lyric_tokens():
    result = run_review_helpers(
        {
            "songs": [
                {"preText": "Título\nC\nEspera----rei amá-lo Rei--, Alelu___ia!\nG\nEspera----rei Rei--"},
                {"preText": "C\nRei-- espera-rei-- Rei-_no"},
            ],
            "line": "Rei-- Rei--, espera-rei-- Rei-_no amá-lo",
            "corrections": {"Rei--": "Rei", "Rei-_no": "Reino"},
        }
    )

    assert result["items"] == [
        {
            "source": "Espera----rei",
            "corrected": "Esperarei",
            "collapsed": None,
            "useCorrected": False,
            "useCollapsed": False,
        },
        {
            "source": "amá-lo",
            "corrected": "amálo",
            "collapsed": None,
            "useCorrected": False,
            "useCollapsed": False,
        },
        {
            "source": "Rei--,",
            "corrected": "Rei,",
            "collapsed": None,
            "useCorrected": False,
            "useCollapsed": False,
        },
        {
            "source": "Alelu___ia!",
            "corrected": "Aleluia!",
            "collapsed": None,
            "useCorrected": False,
            "useCollapsed": False,
        },
        {
            "source": "Rei--",
            "corrected": "Rei",
            "collapsed": None,
            "useCorrected": False,
            "useCollapsed": False,
        },
        {
            "source": "espera-rei--",
            "corrected": "esperarei",
            "collapsed": None,
            "useCorrected": False,
            "useCollapsed": False,
        },
        {
            "source": "Rei-_no",
            "corrected": "Reino",
            "collapsed": None,
            "useCorrected": False,
            "useCollapsed": False,
        },
    ]
    assert result["changed"] == "Rei Rei--, espera-rei-- Reino amá-lo"


def test_offers_collapsed_option_when_removal_joins_equal_letters():
    result = run_review_helpers(
        {
            "songs": [
                {"preText": "Título\nC\numbra---ais at---té"},
            ],
            "line": "umbra---ais at---té",
            "corrections": {"umbra---ais": "umbrais", "at---té": "até"},
        }
    )

    assert result["items"] == [
        {
            "source": "umbra---ais",
            "corrected": "umbraais",
            "collapsed": "umbrais",
            "useCorrected": False,
            "useCollapsed": False,
        },
        {
            "source": "at---té",
            "corrected": "atté",
            "collapsed": "até",
            "useCorrected": False,
            "useCollapsed": False,
        },
    ]
    assert result["changed"] == "umbrais até"


def test_applies_same_selection_in_both_modes_without_changing_chord_comments():
    result = run_review_helpers(
        {
            "songs": [],
            "line": "",
            "preText": "Cabeçalho\nC\n  Espera----rei   amá-lo  \nG7\n  Rei-_no  ",
            "corrections": {"Espera----rei": "Esperarei", "Rei-_no": "Reino"},
        }
    )

    assert result["modes"]["letra"] == "Esperarei amá-lo\nReino"
    assert result["modes"]["cifra"] == "// C\n  Esperarei   amá-lo  \n// G7\n  Reino  "


def test_all_exporters_received_review_flow_and_old_allowlist_is_gone():
    reference_block = (ROOT / "assets/index-variant-1.js").read_text(encoding="utf-8")
    reference_block = reference_block[
        reference_block.index("  // --- Exportar para Holyrics (índice) ---") :
        reference_block.index("  function createHomeButton()")
    ]

    for exporter in EXPORTERS:
        source = exporter.read_text(encoding="utf-8")
        block = source[
            source.index("  // --- Exportar para Holyrics (índice) ---") :
            source.index("  function createHomeButton()")
        ]
        assert block == reference_block
        assert "HOLYRICS_HYPHEN_WORDS" not in source
        assert "cleanLyricHyphensForHolyrics" not in source
