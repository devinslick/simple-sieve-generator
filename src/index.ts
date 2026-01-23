import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  SIEVE_DATA: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  c.header('Cache-Control', 'no-store')
  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sieve Generator</title>
        <style>
          body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          textarea { width: 100%; height: 200px; font-family: monospace; }
          button { padding: 10px 20px; cursor: pointer; margin-right: 5px; }
          .nav { margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
          .nav a { margin-right: 15px; text-decoration: none; color: #333; font-weight: bold; cursor: pointer; }
          .nav a:hover { color: #007bff; }
          input[type="text"] { padding: 8px; width: 300px; margin-bottom: 10px; }
          select { padding: 8px; width: 300px; margin-bottom: 10px; }
          .hidden { display: none; }
        </style>
      </head>
      <body>
        <div class="nav">
          <a onclick="setView('lists')">Lists</a>
          <a onclick="setView('templates')">Templates</a>
          <a onclick="setView('generate')">Generator</a>
        </div>
        
        <div id="app">
          <p>Loading...</p>
        </div>

        <script>
          window.onerror = function(msg, url, line, col, error) {
             const div = document.getElementById('app');
             if (div) {
               div.innerHTML = '<div style="color:red; background:#fff0f0; padding:10px;">' + 
                 '<h3>Client-Side Error</h3>' +
                 'Message: ' + msg + '<br>' + 
                 'Line: ' + line + ':' + col + 
                 '</div>';
             }
          };
        </script>

        <script>
          let currentView = 'lists';

          async function setView(view) {
            currentView = view;
            const app = document.getElementById('app');
            app.innerHTML = '<p>Loading...</p>';
            
            try {
              if (view === 'generate') {
                await renderGenerator();
              } else {
                await renderIndex(view);
              }
            } catch (e) {
              app.innerHTML = '<p style="color:red">Error loading view: ' + e.message + '</p>';
              console.error(e);
            }
          }

          async function renderIndex(type) {
             const app = document.getElementById('app');
             app.innerHTML = '<p>Fetching data...</p>';
             
             // Timeout fetch after 10 seconds
             const controller = new AbortController();
             const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
              const res = await fetch(\`/api/\${type}\`, { signal: controller.signal });
              clearTimeout(timeoutId);

              if (!res.ok) {
                 const text = await res.text();
                 throw new Error(\`Failed to fetch \${type}: \${res.status} \${res.statusText} - \${text}\`);
              }
              
              const items = await res.json();
              
              let html = \`<h2>Manage \${type === 'lists' ? 'Data Lists' : 'Templates'}</h2>\`;
              if (items.length === 0) {
                 html += '<p>No items found.</p>';
              } else {
                html += '<ul>';
                items.forEach(key => {
                  html += \`<li><a href="#" onclick="editItem('\${type}', '\${key}')">\${key}</a></li>\`;
                });
                html += '</ul>';
              }
              html += \`<button onclick="createItem('\${type}')">Create New \${type === 'lists' ? 'List' : 'Template'}</button>\`;
              
              app.innerHTML = html;
            } catch (e) {
              clearTimeout(timeoutId);
              let msg = e.message;
              if (e.name === 'AbortError') msg = 'Request timed out. Check your internet connection or the server status.';
              throw new Error(msg);
            }
          }

          async function createItem(type) {
            const name = prompt(\`Enter \${type === 'lists' ? 'list' : 'template'} name:\`);
            if (name) editItem(type, name, true);
          }

          async function editItem(type, key, isNew = false) {
            let content = '';
            if (!isNew) {
              const res = await fetch(\`/api/\${type}/\${key}\`);
              content = res.ok ? await res.text() : '';
            }

            const app = document.getElementById('app');
            app.innerHTML = \`
              <h3>\${isNew ? 'Creating' : 'Editing'}: \${key}</h3>
              <textarea id="editorContent">\${content}</textarea><br><br>
              <button onclick="saveItem('\${type}', '\${key}')">Save</button>
              \${!isNew ? \`<button onclick="deleteItem('\${type}', '\${key}')" style="background-color: #ff4444; color: white;">Delete</button>\` : ''}
              <button onclick="setView('\${type}')">Back</button>
            \`;
          }

          async function saveItem(type, key) {
            const content = document.getElementById('editorContent').value;
            await fetch(\`/api/\${type}/\${key}\`, { method: 'PUT', body: content });
            alert('Saved!');
            setView(type);
          }

          async function deleteItem(type, key) {
            if (!confirm(\`Delete \${key}?\`)) return;
            await fetch(\`/api/\${type}/\${key}\`, { method: 'DELETE' });
            setView(type);
          }

          async function renderGenerator() {
            // Fetch templates AND lists for dropdowns
            const [tRes, lRes] = await Promise.all([
               fetch('/api/templates'),
               fetch('/api/lists')
            ]);
            
            const templates = await tRes.json();
            const lists = await lRes.json();
            window.availableLists = lists; // Store for helper
            
            const app = document.getElementById('app');
            app.innerHTML = \`
              <h2>Generate Sieve Script</h2>
              <div>
                <label>Template:</label><br>
                <select id="genTemplate" onchange="scanTemplate()">
                  \${templates.map(t => \`<option value="\${t}">\${t}</option>\`).join('')}
                </select>
              </div>
              <br>
              <div id="templateConfig" style="background:#f9f9f9; padding:10px; margin-bottom:10px; border:1px solid #ddd;">
                Loading template config...
              </div>
              <div>
                <label>Rule Name:</label><br>
                <input type="text" id="genRuleName" placeholder="e.g. Bills">
              </div>
              <br>
              <button onclick="generateScript()">Generate</button>
              <br><br>
              <div id="genLogs" style="font-family:monospace; font-size: 0.8em; color: #555; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; max-height: 100px; overflow-y: auto;">Ready.</div>
              <br>
              <textarea id="genOutput" placeholder="Generated script will appear here..."></textarea>
            \`;
            
            // Initial scan
            if (templates.length > 0) setTimeout(scanTemplate, 100);
          }
          
          async function scanTemplate() {
            const templateName = document.getElementById('genTemplate').value;
            const configDiv = document.getElementById('templateConfig');
            configDiv.innerHTML = 'Scanning template variables...';
            
            try {
                const res = await fetch('/api/templates/' + templateName);
                const content = await res.text();
                
                const regex = /\{\{\s*LIST:([\\w\\-\\/]+)(?::(\\w+))?\s*\}\}/g;
                const required = new Set();
                let match;
                while ((match = regex.exec(content)) !== null) {
                    required.add(match[1]);
                }
                
                if (required.size === 0) {
                    configDiv.innerHTML = '<p>No list variables found in this template.</p>';
                    return;
                }
                
                let html = '<h3>Map Template Variables to Lists</h3><table style="width:100%">';
                required.forEach(reqName => {
                    html += \`<tr><td style="padding:5px;">\${reqName}:</td><td style="padding:5px;"><select id="map-\${reqName}" style="width:100%">\`;
                    html += '<option value="">-- Select List --</option>';
                    
                    window.availableLists.forEach(listName => {
                        // Auto-select if the list name matches the placeholder name exactly
                        const selected = listName === reqName ? 'selected' : '';
                        html += \`<option value="\${listName}" \${selected}>\${listName}</option>\`;
                    });
                    
                    html += '</select></td></tr>';
                });
                html += '</table>';
                configDiv.innerHTML = html;
                
            } catch (e) {
                configDiv.innerHTML = '<span style="color:red">Error scanning template: ' + e.message + '</span>';
            }
          }

          async function generateScript() {
            const templateName = document.getElementById('genTemplate').value;
            const ruleName = document.getElementById('genRuleName').value;
            const logArea = document.getElementById('genLogs');
            
            const log = (msg) => {
               logArea.innerHTML += '<div>' + new Date().toLocaleTimeString() + ': ' + msg + '</div>';
               logArea.scrollTop = logArea.scrollHeight;
            };

            logArea.innerHTML = 'Starting generation...';
            
            if (!templateName || !ruleName) {
              alert('Please select a template and enter a rule name.');
              return;
            }

            try {
              // 1. Fetch Template
              const tRes = await fetch(\`/api/templates/\${templateName}\`);
              let content = await tRes.text();
              log('Template loaded (' + content.length + ' chars).');

              // 2. Identify Mappings
              const regex = /\{\{\s*LIST:([\\w\\-\\/]+)(?::(\\w+))?\s*\}\}/g;
              const requiredLists = new Set();
              let match;
              while ((match = regex.exec(content)) !== null) {
                requiredLists.add(match[1]);
              }
              
              const mappings = {};
              requiredLists.forEach(tagName => {
                  const select = document.getElementById('map-' + tagName);
                  if (select && select.value) {
                      mappings[tagName] = select.value;
                  } else {
                      mappings[tagName] = tagName; // Fallback
                      log('Warning: No list mapped for "' + tagName + '", using tag name.');
                  }
              });

              // 3. Fetch Lists
              const uniqueActualLists = new Set(Object.values(mappings));
              const listCache = {};
              
              for (const listName of uniqueActualLists) {
                const lRes = await fetch(\`/api/lists/\${listName}\`);
                if (lRes.ok) {
                   const text = await lRes.text();
                   const items = text.split('\\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
                   listCache[listName] = items;
                   log('Loaded list "' + listName + '" (' + items.length + ' items).');
                } else {
                   listCache[listName] = []; 
                   log('Warning: List "' + listName + '" NOT FOUND or empty.');
                }
              }

              // 4. Replace Tags
              regex.lastIndex = 0; 
              content = content.replace(regex, (m, tagName, mode) => {
                 const actualListName = mappings[tagName];
                 let items = listCache[actualListName] || [];
                 const originalCount = items.length;
                 
                 // Mode filtering
                 if (mode === 'contains') {
                   items = items.filter(i => !i.includes('*') && !i.includes('?'));
                 } else if (mode === 'matches') {
                   items = items.filter(i => i.includes('*') || i.includes('?'));
                 }
                 
                 if (items.length === 0) {
                    if (originalCount > 0) log('List "' + actualListName + '" filtered to 0 items by mode "' + mode + '". using __IGNORE__.');
                    return '"__IGNORE__"';
                 }
                 
                 return items.map(i => \`"\${i.replace(/"/g, '\\\\"')}"\`).join(', ');
              });
              log('Tags replaced.');

              // 5. Replace Rule Name
              const titleCase = ruleName.replace(/\\w\\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
              content = content.replace(/\{\{RULE_NAME\}\}/g, titleCase);
              content = content.replace(/\{\{RULE_NAME_LOWER\}\}/g, ruleName.toLowerCase());

              document.getElementById('genOutput').value = content;
              log('Done.');
            } catch (e) {
              log('Error: ' + e.message);
              console.error(e);
            }
          }

          setView('lists')
            .catch(e => {
              const app = document.getElementById('app');
              app.innerHTML = '<p style="color:red; font-weight:bold;">Critical Error: ' + e.message + '</p>';
              console.error(e);
            });
        </script>
      </body>
    </html>
  `)
})

// API Routes

// Helper to list keys by prefix
async function listKeys(c: any, prefix: string) {
  try {
    const list = await c.env.SIEVE_DATA.list({ prefix })
    // Remove prefix for the client
    return c.json(list.keys.map((k: any) => k.name.substring(prefix.length)))
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
}

app.get('/api/lists', (c) => listKeys(c, 'list:'))
app.get('/api/templates', (c) => listKeys(c, 'template:'))

app.get('/api/lists/:key', async (c) => {
  const key = c.req.param('key')
  const val = await c.env.SIEVE_DATA.get('list:' + key)
  if (val === null) return c.notFound()
  return c.text(val)
})

app.get('/api/templates/:key', async (c) => {
  const key = c.req.param('key')
  const val = await c.env.SIEVE_DATA.get('template:' + key)
  if (val === null) return c.notFound()
  return c.text(val)
})

app.put('/api/lists/:key', async (c) => {
  const key = c.req.param('key')
  const content = await c.req.text()
  await c.env.SIEVE_DATA.put('list:' + key, content)
  return c.json({ success: true })
})

app.put('/api/templates/:key', async (c) => {
  const key = c.req.param('key')
  const content = await c.req.text()
  await c.env.SIEVE_DATA.put('template:' + key, content)
  return c.json({ success: true })
})

app.delete('/api/lists/:key', async (c) => {
  const key = c.req.param('key')
  await c.env.SIEVE_DATA.delete('list:' + key)
  return c.json({ success: true })
})

app.delete('/api/templates/:key', async (c) => {
  const key = c.req.param('key')
  await c.env.SIEVE_DATA.delete('template:' + key)
  return c.json({ success: true })
})

export default app
