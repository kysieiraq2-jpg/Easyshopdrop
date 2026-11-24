/*
 Shop&Drop Fix112 corrected photo preparation.

 Preserves original supported photographs.
 Attempts automatic browser conversion for
 other common camera photograph formats.

 Does not change product uploads, storage,
 screening, publication or payment rules.
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
      png.every((v,i)=>bytes[i]===v)
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
          'We could not read this picture. '+
          'Please choose it again.'
        );
      }

      return await new Promise(
        (resolve,reject)=>{
          const reader=new FileReader();

          reader.onload=()=>
            resolve(reader.result);

          reader.onerror=()=>
            reject(Error(
              'We could not read this picture. '+
              'Please choose it again.'
            ));

          reader.readAsArrayBuffer(file);
        }
      );
    }
  }

  async function convertPhoto(file){
    let picture=null;
    let objectUrl=null;

    try{
      if(
        typeof createImageBitmap==='function'
      ){
        try{
          picture=await createImageBitmap(file);
        }catch(_){}
      }

      if(!picture){
        if(
          typeof Image==='undefined' ||
          !URL?.createObjectURL
        ){
          throw Error('Decoder unavailable');
        }

        objectUrl=URL.createObjectURL(file);

        picture=await new Promise(
          (resolve,reject)=>{
            const img=new Image();

            img.onload=()=>resolve(img);
            img.onerror=()=>reject(
              Error('Picture could not be opened')
            );

            img.src=objectUrl;
          }
        );
      }

      const width=
        picture.naturalWidth||picture.width;
      const height=
        picture.naturalHeight||picture.height;

      if(
        !width || !height ||
        width*height>40000000
      ){
        throw Error('Invalid picture dimensions');
      }

      const canvas=
        document.createElement('canvas');

      canvas.width=width;
      canvas.height=height;

      const ctx=canvas.getContext('2d');

      if(!ctx){
        throw Error('Picture processing unavailable');
      }

      ctx.drawImage(
        picture,0,0,width,height
      );

      const converted=await new Promise(
        (resolve,reject)=>{
          canvas.toBlob(
            blob=>blob
              ?resolve(blob)
              :reject(Error('Conversion failed')),
            'image/jpeg',
            0.88
          );
        }
      );

      if(
        !converted.size ||
        converted.size>MAX_BYTES
      ){
        throw Error('Converted picture too large');
      }

      return converted;
    }finally{
      if(
        picture &&
        typeof picture.close==='function'
      ){
        picture.close();
      }

      if(objectUrl){
        URL.revokeObjectURL(objectUrl);
      }
    }
  }

  async function readOriginal(file){
    if(!file || !file.size){
      throw Error(
        'Please choose a photograph.'
      );
    }

    if(file.size>MAX_BYTES){
      throw Error(
        'This picture is too large. '+
        'Please choose a smaller picture.'
      );
    }

    const data=await readBytes(file);
    const bytes=new Uint8Array(data);

    if(
      bytes.length!==file.size ||
      !bytes.length
    ){
      throw Error(
        'We could not read this picture. '+
        'Please choose it again.'
      );
    }

    let mime=detectMime(
      bytes.subarray(0,24)
    );

    let blob;

    if(mime){
      blob=new Blob(
        [bytes],{type:mime}
      );
    }else{
      const name=String(file.name||'');
      const cameraFormat=
        /^image\//i.test(file.type||'') ||
        /\.(heic|heif|avif|jpg|jpeg|png|webp|bmp|gif)$/i
          .test(name);

      if(!cameraFormat){
        throw Error(
          'This file is not a supported picture. '+
          'Please choose a photograph.'
        );
      }

      try{
        blob=await convertPhoto(file);
        mime='image/jpeg';
      }catch(_){
        throw Error(
          'This picture could not be opened. '+
          'Please try another picture.'
        );
      }
    }

    const extension={
      'image/jpeg':'jpg',
      'image/png':'png',
      'image/webp':'webp'
    }[mime];

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
        'Please select between 1 and 6 pictures.'
      );
    }

    return Promise.all(
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
