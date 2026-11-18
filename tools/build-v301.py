from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
s=Path('Hospitalito_v300.html').read_text()
s=s.replace('Hospitalito v300','Hospitalito v301').replace("HC_DEMO_VERSION='v300'","HC_DEMO_VERSION='v301'").replace('HC Demo v300','HC Demo v301')
# Shared markup is also used in separate print windows without the application CSS.
s=s.replace('width:190px;height:130px','width:104px;height:56px').replace('width:190px!important;height:130px!important','width:104px!important;height:56px!important').replace('.hc283Brand{min-height:145px}', '.hc283Brand{min-height:0}').replace('width:135px!important;height:95px!important','width:80px!important;height:48px!important').replace('.hc283Brand{min-height:105px}', '.hc283Brand{min-height:0}')
s=s.replace("print?'color:#111;background:#fff;border:1px solid #444;padding:12px;margin-bottom:8px;'", "print?'color:#111;background:#fff;border:1px solid #444;padding:4px 8px;margin-bottom:8px;'")
a,b=s.rsplit('</body>',1)
s=a+'<style id="hc-v301-header-styles">'+Path('ui/header.css').read_text()+'</style>\n<script id="hc-v301-header">'+Path('ui/header.js').read_text()+'</script>\n</body>'+b
Path('Hospitalito_v301.html').write_text(s)
