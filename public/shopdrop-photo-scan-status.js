(() => {
  'use strict';

  let sequence=0;

  function statusBox(){
    let box=document.getElementById(
      'shopdropVisibleScanStatus'
    );

    if(box)return box;

    const anchor=document.getElementById(
      'uploadStatus'
    );

    if(!anchor)return null;

    box=document.createElement('div');
    box.id='shopdropVisibleScanStatus';
    box.setAttribute('role','status');
    box.setAttribute('aria-live','polite');
    box.style.cssText=
      'display:block;margin:12px 0;'+
      'padding:14px;border-radius:9px;'+
      'border:2px solid #0f766e;'+
      'background:#effcf8;color:#123b32;'+
      'white-space:pre-line;'+
      'font-weight:600';

    box.textContent=
      'Photograph scanner ready. '+
      'Choose a picture to test.';

    anchor.after(box);
    return box;
  }

  async function scan(files){
    const box=statusBox();
    if(!box||!files.length)return;

    const run=++sequence;

    box.textContent=
      'Scanning '+files.length+
      ' photograph(s)… Please wait.';

    try{
      const module=await import(
        './shopdrop-free-photo-screen.mjs'
      );

      if(run!==sequence)return;

      if(typeof module.scanPhotos!=='function'){
        throw Error('Scanner unavailable');
      }

      const results=await module.scanPhotos(
        files,
        progress=>{
          if(run!==sequence)return;

          if(progress?.state==='scanning'){
            box.textContent=
              'Scanning photograph '+
              progress.current+
              ' of '+progress.total+'…';
          }
        }
      );

      if(run!==sequence)return;

      const lines=results.map((result,i)=>{
        let outcome='No issue detected';

        if(result.status==='reject'){
          outcome='Potential problem';
        }else if(result.status==='review'){
          outcome='Needs further checking';
        }

        return (
          'Photograph '+(i+1)+': '+
          outcome+
          (result.reason
            ?' — '+result.reason
            :'')
        );
      });

      box.textContent=
        'Scan completed.\n'+
        lines.join('\n')+
        '\n\nPreliminary test only. '+
        'Photograph uploads are unchanged.';

    }catch(error){
      if(run!==sequence)return;

      box.textContent=
        'Photograph scanning could not finish. '+
        'The normal photograph uploader '+
        'still works. Please send a screenshot.';
    }
  }

  function init(){
    statusBox();

    for(const id of [
      'photo',
      'shopdropPhotoCamera'
    ]){
      const input=document.getElementById(id);
      if(!input)continue;

      input.addEventListener(
        'change',
        event=>{
          const files=Array.from(
            event.target.files||[]
          );

          if(files.length){
            void scan(files);
          }
        },
        true
      );
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',init,{once:true}
    );
  }else{
    init();
  }
})();
