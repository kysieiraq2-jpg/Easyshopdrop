/* Shop&Drop Fix40 — up to six seller photos.
   Phone camera, gallery or computer.
   Secure Supabase signed uploads.
   No payment activation. */
          (() => {
            'use strict';

            const selected = [];
            const uploaded = new Map();
            let pending = null;
            let originalCount = null;
            let uploading = false;
            let reading = false;
            let pendingSelection = Promise.resolve();
            const linkedPositions = new Set();

            const $ = id => document.getElementById(id);

            const validTypes = new Set([
              'image/jpeg',
              'image/png',
              'image/webp'
            ]);

            const maxRaw = 10 * 1024 * 1024;

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
                  if (uploading || linkedPositions.has((originalCount ?? 0) + index + 1)) {
                    message('A photograph already saved to this item cannot be removed during posting.');
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
                ((originalCount ?? 0) + selected.length) +
                ' of 6 photographs selected or saved. ' +
                'The first photo is the main image.'
              );
            }

            // Capture original gallery bytes while the Android picker still owns
            // the file. No canvas, resampling, JPEG conversion or forced WebP.
            function detectedMime(bytes) {
              if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
                return 'image/jpeg';
              if (bytes.length > 8 &&
                  [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value))
                return 'image/png';
              if (bytes.length > 12 &&
                  String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
                  String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP')
                return 'image/webp';
              return null;
            }

            async function readOriginal(file) {
              if (!file || !file.size || file.size > maxRaw)
                throw Error('Photograph must be between 1 byte and 10 MB.');
              let data;
              try { data = await file.arrayBuffer(); }
              catch {
                // Android content providers can require the FileReader route.
                if (typeof FileReader === 'undefined')
                  throw Error('A selected gallery photograph could not be read.');
                data = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result);
                  reader.onerror = () => reject(Error('The photo could not be read from the gallery.'));
                  reader.readAsArrayBuffer(file);
                });
              }
              const bytes = new Uint8Array(data);
              const mime = detectedMime(bytes.subarray(0, 24));
              if (!mime) throw Error('This photograph uses an image format not yet supported by Shop&Drop storage.');
              const blob = new Blob([bytes], { type: mime });
              return {
                file: {
                  name: String(file.name || 'photograph').slice(0, 150),
                  size: file.size,
                  lastModified: file.lastModified || 0
                },
                mime,
                blob,
                url: URL.createObjectURL(blob)
              };
            }

            async function selectFiles(files) {
              if (uploading || reading) { message('Please finish selecting your photographs.'); return; }
              reading = true;
              try {
              const current = selected.map(x => x.file);
              const additions = [];
              const max = 6 - (originalCount ?? 0);
              for (const file of files) {
                if (selected.length + additions.length >= max) break;
                const duplicate = current.concat(additions).some(x =>
                  x.name === file.name && x.size === file.size &&
                  x.lastModified === file.lastModified);
                if (!duplicate) additions.push(file);
              }
              // Start reading all provider-backed files before the file input is cleared.
              const results = await Promise.allSettled(additions.map(readOriginal));
              let errorMessage = '';
              results.forEach(result => {
                if (result.status === 'fulfilled') selected.push(result.value);
                else errorMessage = String(result.reason?.message || 'Photograph could not be read.');
              });
              render();
              if (files.length + current.length + (originalCount ?? 0) > 6)
                message('Maximum six photographs per item.');
              else if (errorMessage) message(errorMessage);
              } finally { reading = false; }
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

                input.addEventListener('change', async () => {
                  const files = Array.from(input.files || []);
                  try { pendingSelection = selectFiles(files); await pendingSelection; }
                  catch (error) { message(error?.message || 'Could not read photograph.'); }
                  finally { input.value = ''; }
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

            // Original bytes are uploaded directly. The seller never has to
            // convert, crop or screenshot an image before advertising it.

            function clear() {
              selected.forEach(item =>
                URL.revokeObjectURL(item.url)
              );

              selected.length = 0;
              uploaded.clear();
              pending = null;
              originalCount = null;
              linkedPositions.clear();
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
                selected.length > 6 ||
                (selected.length < 1 && !(originalCount > 0))
              ) {
                throw Error(
                  'Select one to six photos for this product.'
                );
              }

              uploading = true;
              try {
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
                (current || []).map(x => Number(x.image_position))
              );
              if (originalCount === null) originalCount = positions.size;
              if (originalCount + selected.length > 6 ||
                  (originalCount === 0 && selected.length === 0))
                throw Error('Choose between one and six photographs.');

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
                const pos = originalCount + index + 1;

                if (positions.has(pos)) { linkedPositions.add(pos); continue; }

                report(
                  'Uploading photograph ' +
                  pos + ' of ' + selected.length
                );

                const source = selected[index].file;
                const blob = selected[index].blob;
                const mime = selected[index].mime;

                let item = uploaded.get(pos);

                if (!item) {

                  const {
                    data: ticket,
                    error: ticketError
                  } = await sb.functions.invoke(
                    'create-signed-upload',
                    {
                      body: {
                        upload_type: 'listing_image',
                        reference,
                        mime_type: mime,
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
                          contentType: mime
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
                      mime_type: mime,
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
                linkedPositions.add(pos);
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
                confirmed.length !== originalCount + selected.length ||
                !Array.from({ length: originalCount + selected.length },
                  (_, i) => i + 1).every(pos =>
                    confirmed.some(row => Number(row.image_position) === pos)
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
              } finally { uploading = false; }
            }

            window.ShopDropProductPhotos = Object.freeze({
              count: () => selected.length,
              ready: () => pendingSelection,
              pendingProduct: () => pending,
              setPending: (product, savedCount) => {
                pending = product;
                originalCount = Number.isInteger(savedCount) ? savedCount : null;
                uploaded.clear();
                linkedPositions.clear();
              },
              recover: (product, savedCount) => {
                clear();
                pending = product;
                originalCount = savedCount;
                render();
              },
              attach
            });
          })();
