import {scanPhotos} from
  './shopdrop-free-photo-screen.mjs';

const ids=[
  'photo',
  'shopdropPhotoCamera'
];

let sequence=0;

function createStatus(){
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
    'margin:12px 0;padding:12px;'+
    'border:1px solid #cbd5e1;'+
    'border-radius:8px;'+
    'background:#f8fafc;'+
    'white-space:pre-line';

  box.textContent=
    'Photograph scanning ready.';

  anchor.after(box);
  return box;
}

async function inspect(files){
  const box=createStatus();
  if(!box||!files.length)return;

  const current=++sequence;

  box.textContent=
    'Scanning photographs… Please wait.';

  try{
    const results=await scanPhotos(
      files,
      progress=>{
        if(current!==sequence)return;

        if(progress?.state==='finished')return;

        box.textContent=
          'Scanning photographs… '+
          String(progress?.current||0)+
          ' of '+files.length;
      }
    );

    if(current!==sequence)return;

    const lines=results.map((result,index)=>{
      const state=
        result.status==='reject'
          ?'Potential problem'
          :result.status==='review'
            ?'Could not confirm'
            :'No issue detected';

      return (
        'Photo '+(index+1)+': '+state+
        (result.reason
          ?' — '+result.reason
          :'')
      );
    });

    box.textContent=
      'Photograph scan results:\n'+
      lines.join('\n')+
      '\n\nThis is a preliminary test. '+
      'The existing upload process is unchanged.';

  }catch(error){
    if(current!==sequence)return;

    box.textContent=
      'Scanning could not finish. '+
      'Photograph selection still works normally.';
  }
}

function start(){
  createStatus();

  for(const id of ids){
    const input=document.getElementById(id);
    if(!input)continue;

    // Capture files before the existing uploader
    // clears its file input.
    input.addEventListener(
      'change',
      event=>{
        const files=Array.from(
          event.target.files||[]
        );

        if(files.length){
          void inspect(files);
        }
      },
      true
    );
  }
}

if(document.readyState==='loading'){
  document.addEventListener(
    'DOMContentLoaded',start,{once:true}
  );
}else{
  start();
}
