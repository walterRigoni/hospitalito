from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
s=Path('Hospitalito_v297.html').read_text()
s=s.replace('Hospitalito v297','Hospitalito v298').replace("HC_DEMO_VERSION='v297'","HC_DEMO_VERSION='v298'").replace('HC Demo v297','HC Demo v298')
css=Path('ui/compact-agenda.css').read_text();js=Path('ui/compact-agenda.js').read_text()
a,b=s.rsplit('</body>',1);s=a+'<style id="hc-v298-compact-agenda-styles">'+css+'</style>\n<script id="hc-v298-compact-agenda">'+js+'</script>\n</body>'+b
Path('Hospitalito_v298.html').write_text(s)
