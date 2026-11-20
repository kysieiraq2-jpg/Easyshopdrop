/*
 Shop&Drop Fix111
 Shared original-photo reader for future
 Other Services and Dispatch integration.

 Does not alter or activate any uploader.
 Does not publish or screen photographs.
*/
(() => {
  'use strict';

  const MAX_BYTES=10485760;

  function detectMime(bytes){
    if(
      bytes.length>=3 &&
      bytes[0]===255 &&
      bytes[1]===216 &&
      bytes[2]===255
    )return 'image/jpeg';

    const png=[137,80,78,71,13,10,26,10];
    if(
      bytes.length>=8 &&
      png.every((value,i)=>bytes[i]===value)
    )return 'image/png';

    if(
      bytes.length>=12 &&
      String.fromCharCode(
        ...bytes.subarray(0,4)
      )==='RIFF' &&
      String.fromCharCode(
        ...bytes.subarray(8,12)
      )==='WEBP'
    )return 'image/webp';

    return null;
  }

  async function readBytes(file){
    try{
      return await file.arrayBuffer();
    }catch(_){
      if(typeof FileReader==='undefined'){
        throw Error(
          'Photograph could not be read.'
        );
      }

      return await new Promise(
        (resolve,reject)=>{
          const reader=new FileReader();

          reader.onload=()=>{
            resolve(reader.result);
          };

          reader.onerror=()=>{
            reject(Error(
              'Photograph could not be read.'
            ));
          };

          reader.readAsArrayBuffer(file);
        }
      );
    }
  }

  async function readOriginal(file){
    if(
      !file ||
      !file.size ||
      file.size>MAX_BYTES
    ){
      throw Error(
        'Photograph must be between 1 byte '+
        'and 10 MB.'
      );
    }

    const data=await readBytes(file);
    const bytes=new Uint8Array(data);

    if(
      bytes.length!==file.size ||
      !bytes.length ||
      bytes.length>MAX_BYTES
    ){
      throw Error(
        'Photograph data is incomplete.'
      );
    }

    const mime=detectMime(
      bytes.subarray(0,24)
    );

    if(!mime){
      throw Error(
        'Only JPEG, PNG and WebP '+
        'photographs are supported.'
      );
    }

    const extension={
      'image/jpeg':'jpg',
      'image/png':'png',
      'image/webp':'webp'
    }[mime];

    const blob=new Blob(
      [bytes],{type:mime}
    );

    return Object.freeze({
      blob,
      mime,
      extension,
      size:blob.size,
      name:String(
        file.name||'photograph'
      ).slice(0,150)
    });
  }

  async function readSelection(files){
    const selected=Array.from(files||[]);

    if(
      selected.length<1 ||
      selected.length>6
    ){
      throw Error(
        'Select between 1 and 6 photographs.'
      );
    }

    return await Promise.all(
      selected.map(readOriginal)
    );
  }

  window.ShopDropSharedPhotoReader=
    Object.freeze({
      detectMime,
      readOriginal,
      readSelection
    });
})();
