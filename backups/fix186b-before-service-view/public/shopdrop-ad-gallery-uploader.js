/*
 Shop&Drop Fix87
 Isolated advertisement gallery uploader.
 Not connected to any live page.
 No payment, booking or product changes.
*/
(() => {
  'use strict';

  const TYPES=Object.freeze({
    service:{
      bucket:'shopdrop-service-ad-gallery',
      table:'shopdrop_service_ad_photos',
      parent:'service_id',
      ownerTable:'services'
    },
    vehicle:{
      bucket:'shopdrop-vehicle-ad-gallery',
      table:'shopdrop_vehicle_ad_photos',
      parent:'vehicle_advert_id',
      ownerTable:'shopdrop_vehicle_adverts'
    }
  });

  const MIME=Object.freeze({
    'image/jpeg':'jpg',
    'image/png':'png',
    'image/webp':'webp'
  });

  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  async function uploadGallery({
    client,
    kind,
    advertisementId,
    files
  }){
    if(!client?.auth || !client?.storage ||
       !client?.from){
      throw Error('Supabase client required.');
    }

    const type=TYPES[kind];
    if(!type){
      throw Error('Invalid advertisement type.');
    }

    if(!UUID.test(String(advertisementId))){
      throw Error('Valid advertisement ID required.');
    }

    const selected=Array.from(files||[]);

    if(!selected.length || selected.length>6){
      throw Error('Select between 1 and 6 photographs.');
    }

    // Fix112: Use original-byte reading when available.
    // Preserve the previous uploader when it is absent.
    const reader=window.ShopDropSharedPhotoReader;
    const prepared=reader?.readSelection
      ?await reader.readSelection(selected)
      :null;

    if(!prepared){
    for(const file of selected){
      if(!MIME[file.type] ||
         file.size<1 ||
         file.size>10485760){
        throw Error(
          'JPEG, PNG or WebP required; maximum 10 MB each.'
        );
      }
    }
    }

    const {data:userData,error:userError}=
      await client.auth.getUser();

    if(userError || !userData?.user?.id){
      throw Error('Please sign in first.');
    }

    const userId=userData.user.id;

    const {data:owner,error:ownerError}=
      await client.from(type.ownerTable)
        .select('id')
        .eq('id',advertisementId)
        .eq('provider_id',userId)
        .maybeSingle();

    if(ownerError || !owner){
      throw Error(
        'Advertisement ownership could not be verified.'
      );
    }

    const {data:existing,error:listError}=
      await client.from(type.table)
        .select('photo_position')
        .eq(type.parent,advertisementId);

    if(listError){
      throw Error('Unable to check existing photographs.');
    }

    const occupied=new Set(
      (existing||[]).map(x=>x.photo_position)
    );

    const available=[1,2,3,4,5,6]
      .filter(position=>!occupied.has(position));

    if(selected.length>available.length){
      throw Error(
        'This advertisement already has photographs. '+
        'Maximum six in total.'
      );
    }

    const saved=[];

    for(let i=0;i<selected.length;i++){
      const file=selected[i];
      const originalPhoto=prepared?.[i];
      const uploadBody=originalPhoto?.blob||file;
      const uploadMime=originalPhoto?.mime||file.type;
      const position=available[i];
      const filename=
        crypto.randomUUID()+'.'+MIME[uploadMime];

      const path=[
        userId,
        advertisementId,
        filename
      ].join('/');

      const {error:uploadError}=
        await client.storage.from(type.bucket)
          .upload(path,uploadBody,{
            contentType:uploadMime,
            upsert:false
          });

      if(uploadError){
        throw Error(
          'Photograph '+(i+1)+
          ' could not be uploaded. '+
          saved.length+
          ' earlier photograph(s) were saved.'
        );
      }

      const record={
        [type.parent]:advertisementId,
        photo_position:position,
        storage_bucket:type.bucket,
        storage_path:path
      };

      const {error:recordError}=
        await client.from(type.table)
          .insert(record);

      if(recordError){
        // Only remove this newly uploaded,
        // unlinked object. Never remove
        // photographs already saved.
        const {error:cleanupError}=
          await client.storage.from(type.bucket)
            .remove([path]);

        if(cleanupError){
          throw Error(
            'Photograph record failed and cleanup '+
            'could not be confirmed. '+
            'Contact support before retrying.'
          );
        }

        throw Error(
          'Photograph record failed. '+
          saved.length+
          ' earlier photograph(s) were saved.'
        );
      }

      saved.push({
        position,
        storage_path:path
      });
    }

    return {
      advertisementId,
      kind,
      savedCount:saved.length,
      photographs:saved
    };
  }

  window.ShopDropAdGalleryUploader=
    Object.freeze({uploadGallery});
})();
