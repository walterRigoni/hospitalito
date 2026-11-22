"""Build the v312 entry points from the standalone v311 release."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / "Hospitalito_v311.html").read_text(encoding="utf-8")


def change(old, new):
    global page
    if page.count(old) != 1:
        raise ValueError(f"Expected one v311 anchor, found {page.count(old)}: {old}")
    page = page.replace(old, new)


for old, new in [
    ("CURRENT_VERSION = 311;", "CURRENT_VERSION = 312;"),
    ("<title>Hospitalito v311", "<title>Hospitalito v312"),
    ('window.HC_DEMO_VERSION="v311";document.title="Hospitalito · Historia Clínica Digital · v311";',
     'window.HC_DEMO_VERSION="v312";document.title="Hospitalito · Historia Clínica Digital · v312";'),
    ('<span id="hc307Version">v311</span>', '<span id="hc307Version">v312</span>'),
    ('>Hospitalito <small>v311</small>', '>Hospitalito <small>v312</small>'),
    ("""user:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0116 0v3"/>'""",
     """user:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0116 0v2"/>',left:'<path d="m15 6-6 6 6 6"/>',right:'<path d="m9 6 6 6-6 6"/>'"""),
    ('<button type="button" data-settings>✎ Días, horarios y tarifas</button>',
     """<button type="button" data-settings>'+window.hc289Icon('edit')+'<span>Días, horarios y tarifas</span></button>"""),
    ('<button type="button" class="hc310SideToggle" aria-controls="hc289Registry">‹</button>',
     '<button type="button" class="hc310SideToggle hc312IconOnly" aria-controls="hc289Registry"></button>'),
    ("toggle.textContent = open?'‹':'›';", "toggle.innerHTML = window.hc289Icon(open?'left':'right');"),
    ('<button type="button" data-prev aria-label="Mes anterior">‹</button>',
     """<button type="button" class="hc312IconOnly" data-prev aria-label="Mes anterior">'+window.hc289Icon('left')+'</button>"""),
    ('<button type="button" data-next aria-label="Mes siguiente">›</button>',
     """<button type="button" class="hc312IconOnly" data-next aria-label="Mes siguiente">'+window.hc289Icon('right')+'</button>"""),
]:
    change(old, new)

style = (root / "ui/v312.css").read_text(encoding="utf-8")
change("</body>\n</html>", f'<style id="hc-v312-icons">\n{style}</style>\n</body>\n</html>')
for filename in ("index.html", "Hospitalito_v312.html"):
    (root / filename).write_text(page, encoding="utf-8")
