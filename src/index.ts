import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  SIEVE_DATA: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
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
          let currentView = 'lists';

          async function setView(view) {
            currentView = view;
            const app = document.getElementById('app');
            app.innerHTML = '<p>Loading...</p>';
            
            if (view === 'generate') {
              renderGenerator();
            } else {
              renderIndex(view);
            }
          }

          async function renderIndex(type) {
            const res = await fetch(\`/api/\${type}\`);
            const items = await res.json();
            const app = document.getElementById('app');
            
            let html = \`<h2>Manage \${type === 'lists' ? 'Data Lists' : 'Templates'}</h2>\`;
            html += '<ul>';
            items.forEach(key => {
              html += \`<li><a href="#" onclick="editItem('\${type}', '\${key}')">\${key}</a></li>\`;
            });
            html += '</ul>';
            html += \`<button onclick="createItem('\${type}')">Create New \${type === 'lists' ? 'List' : 'Template'}</button>\`;
            
            app.innerHTML = html;
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
            // Fetch templates for dropdown
            const res = await fetch('/api/templates');
            const templates = await res.json();
            
            const app = document.getElementById('app');
            app.innerHTML = \`
              <h2>Generate Sieve Script</h2>
              <div>
                <label>Template:</label><br>
                <select id="genTemplate">
                  \${templates.map(t => \`<option value="\${t}">\${t}</option>\`).join('')}
                </select>
              </div>
              <br>
              <div>
                <label>Rule Name:</label><br>
                <input type="text" id="genRuleName" placeholder="e.g. Bills">
              </div>
              <br>
              <button onclick="generateScript()">Generate</button>
              <br><br>
              <textarea id="genOutput" placeholder="Generated script will appear here..."></textarea>
            \`;
          }

          async function generateScript() {
            const templateName = document.getElementById('genTemplate').value;
            const ruleName = document.getElementById('genRuleName').value;
            
            if (!templateName || !ruleName) {
              alert('Please select a template and enter a rule name.');
              return;
            }

            try {
              // 1. Fetch Template
              const tRes = await fetch(\`/api/templates/\${templateName}\`);
              let content = await tRes.text();

              // 2. Identify Lists
              const regex = /\{\{LIST:([\w\-\/]+)(?::(\w+))?\}\}/g;
              const requiredLists = new Set();
              let match;
              while ((match = regex.exec(content)) !== null) {
                requiredLists.add(match[1]);
              }

              // 3. Fetch Lists
              const listCache = {};
              for (const listName of requiredLists) {
                const lRes = await fetch(\`/api/lists/\${listName}\`);
                if (lRes.ok) {
                   const text = await lRes.text();
                   // Split by newlines and filter empty
                   listCache[listName] = text.split('\\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
                } else {
                   listCache[listName] = []; 
                }
              }

              // 4. Replace Tags
              content = content.replace(regex, (m, listName, mode) => {
                 let items = listCache[listName] || [];
                 
                 // Mode filtering
                 if (mode === 'contains') {
                   // Filter items that DO NOT contain wildcards
                   items = items.filter(i => !i.includes('*') && !i.includes('?'));
                 } else if (mode === 'matches') {
                    // Filter items that DO contain wildcards
                   items = items.filter(i => i.includes('*') || i.includes('?'));
                 }
                 
                 if (items.length === 0) return '"__IGNORE__"';
                 
                 // Quote and join
                 return items.map(i => \`"\${i.replace(/"/g, '\\\\"')}"\`).join(', ');
              });

              // 5. Replace Rule Name
              // Title Case
              const titleCase = ruleName.replace(/\\w\\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
              content = content.replace(/\{\{RULE_NAME\}\}/g, titleCase);
              content = content.replace(/\{\{RULE_NAME_LOWER\}\}/g, ruleName.toLowerCase());

              document.getElementById('genOutput').value = content;
            } catch (e) {
              alert('Error generating script: ' + e.message);
              console.error(e);
            }
          }

          setView('lists');
        </script>
      </body>
    </html>
  `)
})

// API Routes

// Helper to list keys by prefix
async function listKeys(c: any, prefix: string) {
  const list = await c.env.SIEVE_DATA.list({ prefix })
  // Remove prefix for the client
  return c.json(list.keys.map((k: any) => k.name.substring(prefix.length)))
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
