from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
s=Path('Hospitalito_v301.html').read_text().replace('Hospitalito v301','Hospitalito v302').replace("HC_DEMO_VERSION='v301'","HC_DEMO_VERSION='v302'").replace('HC Demo v301','HC Demo v302')
# Compact shared print logo too, retaining object-fit:contain.
s=s.replace('width:104px;height:56px','width:72px;height:36px').replace("padding:4px 8px;margin-bottom:8px;", "padding:2px 7px;margin-bottom:4px;")
a,b=s.rsplit('</body>',1);s=a+'<style id="hc-v302-compact-headers">'+Path('ui/compact-headers.css').read_text()+'</style>\n</body>'+b
Path('Hospitalito_v302.html').write_text(s)
