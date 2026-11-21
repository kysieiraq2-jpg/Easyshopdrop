/*
 * Shop&Drop Fix119
 * Free preliminary photograph screening.
 *
 * Tesseract.js: text recognition
 * ZXing: QR and barcode recognition
 *
 * Does not authorize public publication.
 * Does not change existing uploaders.
 */

let workerPromise;
let barcodeReaderPromise;

const patterns = [
  [
    'Email address',
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  ],
  [
    'Website',
    /https?:\/\/|www\.|[a-z0-9-]+\.(?:co\.za|com|net|org)\b/i
  ],
  [
    'Telephone number',
    /(?:\+27|0)[\s().-]*(?:\d[\s().-]*){9}(?!\d)/
  ],
  [
    'Contact information',
    /\b(?:whatsapp|call me|contact us|dm me|instagram|facebook|telegram)\b/i
  ],
  [
    'Street address',
    /\b\d{1,5}\s+(?:[a-z]+\s+){1,4}(?:street|road|avenue|drive|lane|close|crescent)\b/i
  ]
];


const scriptLoads=new Map();

function loadLibrary(url,globalName){
  if(globalThis[globalName]){
    return Promise.resolve(globalThis[globalName]);
  }

  if(!scriptLoads.has(url)){
    const loading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      let finished=false;

      const timeout=setTimeout(()=>{
        fail(new Error(
          globalName+' library loading timed out'
        ));
      },30000);

      function fail(error){
        if(finished)return;
        finished=true;
        clearTimeout(timeout);
        script.remove();
        reject(error);
      }

      script.src=url;
      script.async=true;

      script.onload=()=>{
        if(finished)return;
        clearTimeout(timeout);
        finished=true;

        const library=globalThis[globalName];

        if(library){
          resolve(library);
        }else{
          reject(new Error(
            globalName+' library did not initialize'
          ));
        }
      };

      script.onerror=()=>fail(new Error(
        globalName+' library download failed'
      ));

      document.head.appendChild(script);
    }).catch(error=>{
      scriptLoads.delete(url);
      throw error;
    });

    scriptLoads.set(url,loading);
  }

  return scriptLoads.get(url);
}

async function getOCRWorker(){
  if(!workerPromise){
    workerPromise=loadLibrary(
      'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
      'Tesseract'
    ).then(library=>{
      if(typeof library.createWorker!=='function'){
        throw new Error(
          'OCR worker function unavailable'
        );
      }
      return library.createWorker('eng');
    }).catch(error=>{
      workerPromise=null;
      throw error;
    });
  }

  return workerPromise;
}

async function getBarcodeReader(){
  if(!barcodeReaderPromise){
    barcodeReaderPromise=loadLibrary(
      'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js',
      'ZXing'
    ).then(library=>{
      if(!library.BrowserMultiFormatReader){
        throw new Error(
          'Barcode reader unavailable'
        );
      }

      return new library.BrowserMultiFormatReader();
    }).catch(error=>{
      barcodeReaderPromise=null;
      throw error;
    });
  }

  return barcodeReaderPromise;
}

async function detectBarcode(file){
  if(typeof globalThis.BarcodeDetector==='function'){
    try{
      const detector=new BarcodeDetector();
      const bitmap=await createImageBitmap(file);

      try{
        const found=await detector.detect(bitmap);
        return found.length>0;
      }finally{
        bitmap.close();
      }
    }catch(error){
      // Use ZXing if native detection fails.
    }
  }

  const reader=await getBarcodeReader();
  const url=URL.createObjectURL(file);

  try{
    try{
      const result=await reader.decodeFromImageUrl(
        url
      );
      return Boolean(result);
    }catch(error){
      if(
        error?.name==='NotFoundException' ||
        error?.constructor?.name==='NotFoundException'
      ){
        return false;
      }

      throw error;
    }
  }finally{
    URL.revokeObjectURL(url);
  }
}

function inspectText(text) {
  const normalized =
    String(text || '').normalize('NFKC');

  for (const [reason, pattern] of patterns) {
    if (pattern.test(normalized)) {
      return {
        status: 'reject',
        reason
      };
    }
  }

  if (normalized.trim()) {
    return {
      status: 'review',
      reason: 'Other writing detected'
    };
  }

  return {
    status: 'preliminary_pass',
    reason: 'No prohibited writing detected'
  };
}

export async function scanPhotos(
  files,
  onProgress = () => {}
) {
  const selected = Array.from(files || []);

  if (
    selected.length < 1 ||
    selected.length > 6
  ) {
    throw Error(
      'Choose between 1 and 6 photographs.'
    );
  }

  const results = [];

  for (
    let i = 0;
    i < selected.length;
    i++
  ) {
    const file = selected[i];
    const started = performance.now();

    onProgress({
      state: 'scanning',
      current: i + 1,
      total: selected.length
    });

    if (
      !file.type.startsWith('image/') ||
      !file.size ||
      file.size > 10485760
    ) {
      results.push({
        name: file.name,
        status: 'review',
        reason: 'Invalid or oversized photograph',
        seconds: 0
      });

      continue;
    }

    try {
      const [ocrCheck,barcodeCheck] =
      await Promise.allSettled([
        getOCRWorker().then(worker =>
          worker.recognize(file)
        ),
        detectBarcode(file)
      ]);

    let decision;

    if(
      barcodeCheck.status==='fulfilled' &&
      barcodeCheck.value===true
    ){
      decision={
        status:'reject',
        reason:'QR code or barcode detected'
      };
    }else if(
      ocrCheck.status==='fulfilled'
    ){
      const textDecision=inspectText(
        ocrCheck.value?.data?.text
      );

      if(textDecision.status==='reject'){
        decision=textDecision;
      }else if(
        barcodeCheck.status==='rejected'
      ){
        decision={
          status:'review',
          reason:
            'Text check completed. '+
            'Barcode check unavailable: '+
            String(
              barcodeCheck.reason?.name||
              'Unknown error'
            ).slice(0,80)
        };
      }else{
        decision=textDecision;
      }
    }else{
      decision={
        status:'review',
        reason:
          'Text recognition unavailable: '+
          String(
            ocrCheck.reason?.name||
            'Unknown error'
          ).slice(0,80)+
          (
            barcodeCheck.status==='rejected'
              ?'. Barcode recognition unavailable: '+
                String(
                  barcodeCheck.reason?.name||
                  'Unknown error'
                ).slice(0,80)
              :'. Barcode check completed.'
          )
      };
    }

      results.push({
        name: file.name,
        ...decision,
        seconds: Number(
          (
            (performance.now() - started) /
            1000
          ).toFixed(1)
        )
      });

    } catch (error) {
      results.push({
        name: file.name,
        status: 'review',
        reason:
          'Scanner error: '+String(error?.name||'Unknown error').slice(0,80),
        seconds: Number(
          (
            (performance.now() - started) /
            1000
          ).toFixed(1)
        )
      });
    }
  }

  onProgress({
    state: 'finished',
    current: selected.length,
    total: selected.length
  });

  return results;
}
