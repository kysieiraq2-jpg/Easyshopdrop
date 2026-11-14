/* Shop&Drop Fix40 — up to six seller photos.
   Phone camera, gallery or computer.
   Secure Supabase signed uploads.
   No payment activation. */
          (() => {
            'use strict';

            const selected = [];
            const uploaded = new Map();
            let pending = null;

            const $ = id => document.getElementById(id);

            const validTypes = new Set([
              'image/jpeg',
              'image/png',
              'image/webp'
            ]);

            const maxRaw = 15 * 1024 * 1024;
            const maxPrepared = 10 * 1024 * 1024;

            function message(value) {
              const node = $('uploadStatus');
              if (node) node.textContent = value;
            }

            function render() {
              const area = $('shopdropPhotoPreview');
              if (!area) return;

              area.replaceChildren();

              selected.forEach((item, index) => {
                const tile = document.createElement('div');
                tile.style.cssText =
                  'display:inline-flex;flex-direction:column;' +
                  'align-items:center;gap:4px;margin:6px;' +
                  'padding:5px;border:1px solid #cbd5e1;' +
                  'border-radius:8px';

                const img = document.createElement('img');
                img.src = item.url;
                img.alt = 'Product photograph ' + (index + 1);
                img.style.cssText =
                  'height:80px;width:80px;object-fit:cover;' +
                  'border-radius:6px';

                const remove = document.createElement('button');
                remove.type = 'button';
                remove.textContent = 'Remove ' + (index + 1);

                remove.addEventListener('click', () => {
                  if (pending) {
                    message(
                      'Finish the current listing upload first.'
                    );
                    return;
                  }

                  URL.revokeObjectURL(item.url);
                  selected.splice(index, 1);
                  render();
                });

                tile.append(img, remove);
                area.append(tile);
              });

              message(
                selected.length +
                ' of 6 photographs selected. ' +
                'The first photo is the main image.'
              );
            }

            function selectFiles(files) {
              if (pending) {
                message(
                  'Finish uploading the pending listing first.'
                );
                return;
              }

              for (const file of files) {
                if (selected.length >= 6) {
                  render();
                  message('Maximum six photographs allowed.');
                  return;
                }

                if (
                  !validTypes.has(file.type) ||
                  !file.size ||
                  file.size > maxRaw
                ) {
                  render();
                  message(
                    'Choose JPG, PNG or WebP images ' +
                    'no larger than 15 MB each.'
                  );
                  return;
                }

                const duplicate = selected.some(x =>
                  x.file.name === file.name &&
                  x.file.size === file.size &&
                  x.file.lastModified === file.lastModified
                );

                if (duplicate) continue;

                selected.push({
                  file,
                  url: URL.createObjectURL(file)
                });
              }

              render();
            }

            function init() {
              for (const id of [
                'photo',
                'shopdropPhotoCamera'
              ]) {
                const input = $(id);

                if (
                  !input ||
                  input.dataset.shopdropPhotosReady
                ) continue;

                input.dataset.shopdropPhotosReady = 'true';

                input.addEventListener('change', () => {
                  const files = Array.from(input.files || []);
                  input.value = '';
                  selectFiles(files);
                });
              }

              render();
            }

            if (document.readyState === 'loading') {
              document.addEventListener(
                'DOMContentLoaded',
                init,
                { once: true }
              );
            } else {
              init();
            }

            async function optimize(file) {
              const url = URL.createObjectURL(file);

              try {
                const img = await new Promise(
                  (resolve, reject) => {
                    const node = new Image();

                    node.onload = () => resolve(node);
                    node.onerror = () => reject(
                      Error('Photograph cannot be opened.')
                    );
                    node.src = url;
                  }
                );

                const ratio = Math.min(
                  1,
                  1200 / img.naturalWidth,
                  1200 / img.naturalHeight
                );

                if (
                  !Number.isFinite(ratio) ||
                  ratio <= 0
                ) {
                  throw Error('Invalid photograph dimensions.');
                }

                const canvas = document.createElement('canvas');

                canvas.width = Math.max(
                  1,
                  Math.round(img.naturalWidth * ratio)
                );

                canvas.height = Math.max(
                  1,
                  Math.round(img.naturalHeight * ratio)
                );

                const ctx = canvas.getContext('2d');

                if (!ctx) {
                  throw Error(
                    'Photo preparation is unsupported.'
                  );
                }

                ctx.drawImage(
                  img,
                  0,
                  0,
                  canvas.width,
                  canvas.height
                );

                const blob = await new Promise(resolve =>
                  canvas.toBlob(
                    resolve,
                    'image/webp',
                    0.82
                  )
                );

                if (
                  !blob ||
                  blob.type !== 'image/webp' ||
                  !blob.size ||
                  blob.size > maxPrepared
                ) {
                  throw Error(
                    'Photo preparation failed. ' +
                    'Try a smaller image.'
                  );
                }

                return blob;

              } finally {
                URL.revokeObjectURL(url);
              }
            }

            function clear() {
              selected.forEach(item =>
                URL.revokeObjectURL(item.url)
              );

              selected.length = 0;
              uploaded.clear();
              pending = null;
              render();
            }

            async function attach(
              sb,
              sellerId,
              product,
              report
            ) {
              if (
                !pending ||
                pending.id !== product.id ||
                selected.length < 1 ||
                selected.length > 6
              ) {
                throw Error(
                  'Select one to six photos for this product.'
                );
              }

              const { data: current, error: readError } =
                await sb
                  .from('listing_images')
                  .select('image_position')
                  .eq('product_id', product.id);

              if (readError) {
                throw Error(
                  'Cannot check listing photos: ' +
                  readError.message
                );
              }

              const positions = new Set(
                (current || []).map(
                  x => Number(x.image_position)
                )
              );

              const reference = String(
                product.listing_reference || product.id
              )
                .replace(/[^A-Za-z0-9_-]/g, '_')
                .slice(0, 120);

              for (
                let index = 0;
                index < selected.length;
                index++
              ) {
                const pos = index + 1;

                if (positions.has(pos)) continue;

                report(
                  'Uploading photograph ' +
                  pos + ' of ' + selected.length
                );

                const source = selected[index].file;

                let item = uploaded.get(pos);

                if (!item) {
                  const blob = await optimize(source);

                  const {
                    data: ticket,
                    error: ticketError
                  } = await sb.functions.invoke(
                    'create-signed-upload',
                    {
                      body: {
                        upload_type: 'listing_image',
                        reference,
                        mime_type: 'image/webp',
                        file_size: blob.size
                      }
                    }
                  );

                  if (
                    ticketError ||
                    ticket?.ok !== true ||
                    ticket.bucket !== 'listing-images' ||
                    !ticket.path ||
                    !ticket.token ||
                    !ticket.path.startsWith(sellerId + '/')
                  ) {
                    throw Error(
                      'Secure photo upload could not be prepared.'
                    );
                  }

                  const { error: uploadError } =
                    await sb.storage
                      .from('listing-images')
                      .uploadToSignedUrl(
                        ticket.path,
                        ticket.token,
                        blob,
                        {
                          contentType: 'image/webp'
                        }
                      );

                  if (uploadError) {
                    throw Error(
                      'Photograph ' + pos +
                      ' upload failed: ' +
                      uploadError.message
                    );
                  }

                  item = {
                    path: ticket.path,
                    size: blob.size
                  };

                  uploaded.set(pos, item);
                }

                const { error: linkError } =
                  await sb
                    .from('listing_images')
                    .insert({
                      product_id: product.id,
                      image_reference:
                        'SD-IMG-' + crypto.randomUUID(),
                      storage_bucket: 'listing-images',
                      storage_path: item.path,
                      image_position: pos,
                      is_primary: pos === 1,
                      original_filename:
                        source.name.slice(0, 150),
                      mime_type: 'image/webp',
                      file_size_bytes: item.size
                    });

                if (linkError) {
                  throw Error(
                    'Photograph ' + pos +
                    ' link failed: ' +
                    linkError.message
                  );
                }

                positions.add(pos);
              }

              const {
                data: confirmed,
                error: checkError
              } = await sb
                .from('listing_images')
                .select('image_position')
                .eq('product_id', product.id);

              if (
                checkError ||
                !Array.isArray(confirmed) ||
                confirmed.length !== selected.length ||
                !selected.every(
                  (_, i) => confirmed.some(
                    row => row.image_position === i + 1
                  )
                )
              ) {
                throw Error(
                  'Photo verification incomplete. ' +
                  'Press Submit again to retry.'
                );
              }

              const count = confirmed.length;
              clear();
              return count;
            }

            window.ShopDropProductPhotos = Object.freeze({
              count: () => selected.length,
              pendingProduct: () => pending,
              setPending: product => {
                pending = product;
                uploaded.clear();
              },
              attach
            });
          })();
