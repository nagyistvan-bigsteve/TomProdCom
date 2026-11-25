// Builds a single self-contained mockup file (logos embedded) that can be sent to the owner.
// Usage: node docs/mockups/build-mockup.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const images = join(here, '..', '..', 'src', 'assets', 'images');
const dataUri = file => 'data:image/png;base64,' + readFileSync(join(images, file)).toString('base64');

const html = readFileSync(join(here, 'location-switch.template.html'), 'utf8')
  .replaceAll('__LOGO_LUMBER__', dataUri('logo-outline.png'))
  .replaceAll('__LOGO_INSTAL__', dataUri('logo-instal.png'));

writeFileSync(join(here, 'location-switch.html'), html);
console.log('Wrote docs/mockups/location-switch.html');
