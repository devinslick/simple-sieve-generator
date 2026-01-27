
import { Hono } from 'hono';
type Bindings = {
  SIEVE_DATA: KVNamespace
  DEMO_MODE?: string
  BRANCH?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Helper to get key prefix based on branch
// Main branch (or unset) uses no prefix for backwards compatibility
function getKeyPrefix(env: Bindings): string {
  const branch = env.BRANCH;
  if (!branch || branch === 'main') return '';
  return `branch:${branch}:`;
}

app.get('/', (c) => {
  const isDemo = c.env.DEMO_MODE === 'true';
  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Simple Sieve Generator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          :root {
            /* Default: Dark Mode */
            --primary: #3a8fd9;
            --danger: #e74c3c;
            /* Demo Mode Warning Color */
            --warning: #f39c12; 
            --bg-body: #121212;
            --bg-card: #1e1e1e;
            --bg-input: #2d2d2d;
            --border: #444;
            --text: #e0e0e0;
            --text-muted: #aaa;
            --log-bg: #1a1a1a;
          }
          :root[data-theme="light"] {
            /* Light Mode Overrides */
            --primary: #007bff;
            --danger: #dc3545;
            --bg-body: #ffffff;
            --bg-card: #f8f9fa;
            --bg-input: #ffffff;
            --border: #ccc;
            --text: #333333;
            --text-muted: #666;
            --log-bg: #f1f1f1;
          }

          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            max-width: 900px; 
            margin: 0 auto; 
            padding: 1rem;
            background-color: var(--bg-body);
            color: var(--text);
            line-height: 1.6;
            transition: background-color 0.3s, color 0.3s;
          }
          h1 { margin: 0; font-size: 1.75rem; }
          
          /* Header Layout */
          header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
          }
          
          /* Forms */
          label { display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.95rem; }
          input[type="text"], select, textarea {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 1rem;
            margin-bottom: 1rem;
            font-family: inherit;
            background-color: var(--bg-input);
            color: var(--text);
          }
          textarea {
            min-height: 200px;
            font-family: monospace;
            resize: vertical;
          }
          
          /* Buttons */
          button { 
            padding: 0.75rem 1.25rem; 
            cursor: pointer; 
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 500;
            transition: opacity 0.2s;
            background-color: var(--border); /* Default btn bg */
            color: var(--text);
          }
          button:hover { opacity: 0.9; }
          .btn-primary { background-color: var(--primary); color: white; }
          .btn-danger { background-color: var(--danger); color: white; }
          
          /* Layout Components */
          .card {
            background: var(--bg-card);
            padding: 1.25rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            border: 1px solid var(--border);
          }
          
          .controls-row {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          .controls-row select { flex: 1; min-width: 250px; margin-bottom: 0; }
          .controls-row button { flex-shrink: 0; }
          
          .log-box {
            font-family: monospace; 
            font-size: 0.85em; 
            color: var(--text-muted); 
            background: var(--log-bg); 
            padding: 1rem; 
            border-radius: 6px; 
            border: 1px solid var(--border);
            max-height: 300px; 
            overflow-y: auto;
            white-space: pre-wrap;
          }

          /* Theme Toggle */
          .theme-toggle {
            background: none;
            border: 1px solid var(--border);
            padding: 0.5rem;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          /* Responsive */
          @media (max-width: 600px) {
            .controls-row { flex-wrap: nowrap; gap: 4px; }
            .controls-row select { flex: 1; min-width: 100px; }
            .controls-row button { padding: 0.5rem; font-size: 0.75rem; }
            .controls-row .btn-icon { padding: 0.4rem 0.5rem; }
            h1 { font-size: 1.5rem; }
            body { padding: 0.75rem; }
          }

          /* Basic Mode Builder */
          .builder-mode-hidden { display: none; }
          .builder-section { 
              margin-bottom: 2rem; 
              border: 1px solid var(--border);
              border-radius: 8px;
              padding: 1rem;
              background-color: var(--bg-card);
          }
          .builder-section h3 { margin-top: 0; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
          .rule-row {
              display: flex;
              gap: 8px;
              margin-bottom: 10px;
              align-items: center;
              padding: 8px;
              background: var(--bg-input);
              border-radius: 4px;
              flex-wrap: wrap;
          }
          .rule-row select, .rule-row input[type="text"] { margin-bottom: 0; width: auto; flex: 1; min-width: 150px; }
          .rule-actions { display: flex; gap: 8px; align-items: center; }
          .rule-actions label { margin-bottom: 0; font-weight: normal; font-size: 0.85em; display: flex; align-items: center; gap: 4px; }
          .rule-delete-btn { background: var(--danger); color: white; padding: 4px 8px; font-size: 0.8em; width: auto; }
          .add-rule-btn { width: 100%; padding: 8px; border: 1px dashed var(--border); background: none; color: var(--text-muted); }
          .add-rule-btn:hover { background: var(--border); color: var(--text); }
        </style>
        <script>
            // --- UI LOGIC ---
            const IS_DEMO = ${isDemo};
            let ALL_LISTS = [];

            function initTheme() {
                const stored = localStorage.getItem('theme');
                if (stored) {
                    document.documentElement.setAttribute('data-theme', stored);
                } else {
                    // Default is Dark (no attribute needed as per :root)
                }
                updateThemeIcon();
            }

            function toggleTheme() {
                const current = document.documentElement.getAttribute('data-theme');
                const next = current === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('theme', next);
                updateThemeIcon();
            }

            function updateThemeIcon() {
                const isLight = document.documentElement.getAttribute('data-theme') === 'light';
                document.getElementById('themeIcon').textContent = isLight ? '🌙' : '☀️';
            }

            async function loadListNames() {
                if (IS_DEMO) {
                    const selector = document.getElementById('savedLists');
                    selector.innerHTML = '<option value="">-- Demo Mode (Saving Disabled) --</option>';
                    selector.disabled = true;
                    return;
                }

                try {
                    const res = await fetch('/api/lists');
                    if(res.ok) {
                        ALL_LISTS = await res.json();
                        const selector = document.getElementById('savedLists');
                        
                        // Preserve selected if possible
                        const savedVal = selector.value;
                        
                        selector.innerHTML = '<option value="">-- Load Saved List --</option>' + 
                            ALL_LISTS.map(function(l) { return '<option value="' + l + '">' + l + '</option>'; }).join('');
                            
                        if (savedVal && ALL_LISTS.includes(savedVal)) {
                            selector.value = savedVal;
                        }
                    }
                } catch(e) { console.error('Failed to load lists', e); }
            }

            async function saveCurrentList() {
                if (IS_DEMO) {
                    alert("This feature is disabled in Demo Mode.");
                    return;
                }
                
                // Use Folder Name field for list name
                const name = document.getElementById('folderName').value.trim();
                
                if(!name) {
                    alert("Please enter a Folder Name to save this list.");
                    return;
                }
                
                const content = document.getElementById('rulesInput').value;
                try {
                    await fetch('/api/lists/' + name, { method: 'PUT', body: content });
                    alert('Saved as "' + name + '"!');
                    loadListNames(); 
                    // Set dropdown to this new name if exists
                    document.getElementById('savedLists').value = name;
                } catch(e) { alert('Error saving: ' + e.message); }
            }
            
            async function moveList(direction) {
                if (IS_DEMO) return;
                const name = document.getElementById('savedLists').value;
                if (!name) return;
                
                const idx = ALL_LISTS.indexOf(name);
                if (idx < 0) return;
                
                if (direction === -1 && idx > 0) {
                     // Move Up
                     [ALL_LISTS[idx], ALL_LISTS[idx-1]] = [ALL_LISTS[idx-1], ALL_LISTS[idx]];
                } else if (direction === 1 && idx < ALL_LISTS.length - 1) {
                     // Move Down
                     [ALL_LISTS[idx], ALL_LISTS[idx+1]] = [ALL_LISTS[idx+1], ALL_LISTS[idx]];
                } else {
                    return; // No move possible
                }
                
                // Optimistic UI Update
                const selector = document.getElementById('savedLists');
                selector.innerHTML = '<option value="">-- Load Saved List --</option>' + 
                            ALL_LISTS.map(function(l) { return '<option value="' + l + '">' + l + '</option>'; }).join('');
                selector.value = name;
                
                // Sync to Server
                try {
                    await fetch('/api/lists/order', {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify(ALL_LISTS)
                    });
                } catch(e) {
                    console.error('Failed to save order', e);
                    alert('Failed to save list order');
                    loadListNames(); // revert
                }
            }

            async function deleteCurrentList() {
                if (IS_DEMO) {
                    alert("This feature is disabled in Demo Mode.");
                    return;
                }

                const name = document.getElementById('savedLists').value;
                if(!name) {
                    alert("No list selected to delete.");
                    return;
                }
                
                if(!confirm('Are you sure you want to delete the list "' + name + '"?')) return;
                
                try {
                    await fetch('/api/lists/' + name, { method: 'DELETE' });
                    alert('Deleted!');
                    loadListNames();
                    document.getElementById('rulesInput').value = '';
                    document.getElementById('folderName').value = '';
                } catch(e) { alert('Error deleting: ' + e.message); }
            }

            async function loadSelectedList() {
                const name = document.getElementById('savedLists').value;
                if(!name) return;

                // Update Folder Name input match selected list
                document.getElementById('folderName').value = name;

                const res = await fetch('/api/lists/' + name);
                if(res.ok) {
                    document.getElementById('rulesInput').value = await res.text();
                }
            }

            async function generateScript() {
                const folderName = document.getElementById('folderName').value;
                const rulesInput = document.getElementById('rulesInput').value;
                
                try {
                    const response = await fetch('/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folderName, rulesInput })
                    });
                    
                    if (!response.ok) throw new Error(await response.text());
                    
                    const data = await response.json();
                    document.getElementById('genOutput').value = data.script;
                    document.getElementById('genLogs').innerText = 'Generation successful!';
                } catch (e) {
                    document.getElementById('genLogs').innerText = 'Error: ' + e.message;
                    console.error(e);
                }
            }
            
            async function copyToClipboard() {
                const copyText = document.getElementById("genOutput");
                if (!copyText.value) return;
                
                try {
                    await navigator.clipboard.writeText(copyText.value);
                    const btn = document.getElementById('copyBtn');
                    const originalText = btn.innerText;
                    btn.innerText = "Copied!";
                    setTimeout(() => btn.innerText = originalText, 2000);
                } catch (err) {
                    console.error('Failed to copy: ', err);
                    alert("Failed to copy to clipboard");
                }
            }
            
            // Init
            window.onload = () => {
                initTheme();
                loadListNames();
                
                // Init Builder State after everything loads
                const mode = localStorage.getItem('editorMode') || 'advanced';
                setEditorMode(mode);
            };

            // --- SIMPLE ADD RULE LOGIC ---

            function setEditorMode(mode) {
                localStorage.setItem('editorMode', mode);
                const addRuleForm = document.getElementById('addRuleForm');
                const toggle = document.getElementById('modeToggle');
                const legendLink = document.getElementById('legendLink');

                if (mode === 'basic') {
                    addRuleForm.classList.remove('builder-mode-hidden');
                    legendLink.style.display = 'none';
                    toggle.innerText = 'Hide rule entry form';
                } else {
                    addRuleForm.classList.add('builder-mode-hidden');
                    legendLink.style.display = 'inline';
                    toggle.innerText = 'Show rule entry form';
                }
            }

            function toggleEditorMode() {
                const current = localStorage.getItem('editorMode') || 'basic';
                setEditorMode(current === 'basic' ? 'advanced' : 'basic');
            }

            function addRule() {
                const ruleType = document.getElementById('newRuleType').value;
                const matchText = document.getElementById('newRuleMatch').value.trim();

                if (!matchText) {
                    alert('Please enter match text');
                    return;
                }

                // Build flags string
                let flags = '';
                if (document.getElementById('flagF').checked) flags += 'F';
                if (document.getElementById('flagR').checked) flags += 'R';
                if (document.getElementById('flagA').checked) flags += 'A';
                if (document.getElementById('flagS').checked) flags += 'S';
                if (document.getElementById('flagB').checked) flags += 'B';
                if (document.getElementById('flagD').checked) flags += 'D';

                const label = document.getElementById('newRuleLabel').value.trim();
                if (label) flags += '!' + label + '!';

                if (!flags) flags = 'F'; // Default to File

                // Build the rule line
                let ruleLine = '';
                if (ruleType === 'alias') {
                    const aliases = document.getElementById('newRuleAliases').value.trim();
                    if (!aliases) {
                        alert('Please enter destination mailbox(es)');
                        return;
                    }
                    ruleLine = '!' + aliases + '!' + flags;
                    if (matchText && matchText !== aliases) {
                        ruleLine += ' ' + matchText;
                    }
                } else if (ruleType === 'from') {
                    ruleLine = 'from:' + matchText + ' ' + flags;
                } else {
                    ruleLine = matchText + ' ' + flags;
                }

                // Append to textarea
                const textarea = document.getElementById('rulesInput');
                const currentText = textarea.value.trim();
                textarea.value = currentText ? currentText + '\\n' + ruleLine : ruleLine;

                // Clear form
                document.getElementById('newRuleMatch').value = '';
                document.getElementById('newRuleLabel').value = '';
                document.getElementById('newRuleAliases').value = '';
                document.getElementById('flagF').checked = true;
                document.getElementById('flagR').checked = false;
                document.getElementById('flagA').checked = false;
                document.getElementById('flagS').checked = false;
                document.getElementById('flagB').checked = false;
                document.getElementById('flagD').checked = false;
                updateRuleTypeFields();
                toggleLabelField();
            }

            function updateRuleTypeFields() {
                const ruleType = document.getElementById('newRuleType').value;
                const aliasField = document.getElementById('aliasFieldWrapper');
                const matchLabel = document.getElementById('matchLabel');

                if (ruleType === 'alias') {
                    aliasField.style.display = 'block';
                    matchLabel.innerText = 'Subject Filter (optional):';
                } else {
                    aliasField.style.display = 'none';
                    matchLabel.innerText = ruleType === 'from' ? 'Email/Domain:' : 'Subject Text:';
                }
            }

            function toggleLabelField() {
                const labelField = document.getElementById('labelFieldWrapper');
                const isDesignateChecked = document.getElementById('flagD').checked;
                labelField.style.display = isDesignateChecked ? 'block' : 'none';
            }
        </script>
      </head>
      <body>
        <header>
            <h1>
                Simple Sieve Generator
                ${isDemo ? '<span style="font-size: 0.5em; background: var(--warning); color: #000; padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin-left: 10px;">DEMO MODE</span>' : ''}
            </h1>
            <button class="theme-toggle" onclick="toggleTheme()" title="Toggle Dark/Light Mode">
                <span id="themeIcon">☀️</span>
            </button>
        </header>
        
        <div class="card">
             <label for="savedLists">Load/Manage Saved List:</label>
             <div class="controls-row">
                 <select id="savedLists" onchange="loadSelectedList()"></select>
                 <button class="btn-icon" onclick="moveList(-1)" title="Move Up">⬆️</button>
                 <button class="btn-icon" onclick="moveList(1)" title="Move Down">⬇️</button>
                 <button onclick="saveCurrentList()">Save</button>
                 <button onclick="deleteCurrentList()" class="btn-danger">Delete</button>
             </div>
        </div>

        <div>
          <label for="folderName">Folder Name / List Name (e.g. "Shopping"):</label>
          <input type="text" id="folderName" value="Shopping">
        </div>
        
        <div>
          <label for="rulesInput">
              Rules List:
              <a id="legendLink" href="/legend" target="_blank" style="font-size: 0.9em; color: var(--primary); text-decoration: none;">(View Legend)</a>
              <button id="modeToggle" onclick="toggleEditorMode()" style="float: right; font-size: 0.8em; padding: 2px 8px; margin-top: -5px;">Show rule entry form</button>
          </label>
          <textarea id="rulesInput" placeholder="Subject Rule F&#10;from:sender@example.com FR&#10;!alias1,alias2!F"></textarea>

          <div id="addRuleForm" class="builder-mode-hidden card" style="margin-top: 1rem; padding: 1rem;">
            <h3 style="margin-top: 0;">Add New Rule</h3>

            <div style="margin-bottom: 0.75rem;">
              <label>Rule Type:</label>
              <select id="newRuleType" onchange="updateRuleTypeFields()" style="width: 100%;">
                <option value="subject">Subject Match</option>
                <option value="from">From/Sender Match</option>
                <option value="alias">Destination Mailbox Rule</option>
              </select>
            </div>

            <div id="aliasFieldWrapper" style="display: none; margin-bottom: 0.75rem;">
              <label>Destination Mailbox(es) (comma-separated):</label>
              <input type="text" id="newRuleAliases" placeholder="alias1, alias2" style="width: 100%;">
            </div>

            <div style="margin-bottom: 0.75rem;">
              <label id="matchLabel">Subject Text:</label>
              <input type="text" id="newRuleMatch" placeholder="Text to match" style="width: 100%;">
            </div>

            <div style="margin-bottom: 0.75rem;">
              <label>Actions:</label>
              <div class="rule-actions" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                <label><input type="checkbox" id="flagF" checked> File</label>
                <label><input type="checkbox" id="flagR"> Read</label>
                <label><input type="checkbox" id="flagA"> Archive</label>
                <label><input type="checkbox" id="flagS"> Stop</label>
                <label><input type="checkbox" id="flagB"> Block</label>
                <label><input type="checkbox" id="flagD" onchange="toggleLabelField()"> Designate</label>
              </div>
            </div>

            <div id="labelFieldWrapper" style="display: none; margin-bottom: 0.75rem;">
              <label>Designated Label:</label>
              <input type="text" id="newRuleLabel" placeholder="Label name" style="width: 100%;">
            </div>

            <button onclick="addRule()" class="btn-primary" style="width: 100%;">Add Rule</button>
          </div>
        </div>
        
        <button onclick="generateScript()" class="btn-primary" style="width: 100%; margin-bottom: 1.5rem;">Generate Sieve Script</button>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label style="margin-bottom: 0;">Generated Output:</label>
            <button id="copyBtn" onclick="copyToClipboard()" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;">Copy to Clipboard</button>
        </div>
        <textarea id="genOutput" placeholder="Generated script will appear here..." readonly style="background: var(--bg-input); color: var(--text);"></textarea>
        
        <div id="genLogs" class="log-box">Ready.</div>
      </body>
    </html>
  `);
});

// --- API ROUTES FOR SAVE/LOAD ---

async function getListOrder(env: Bindings) {
    const prefix = getKeyPrefix(env);
    const orderKey = prefix + 'config:list_order';
    const raw = await env.SIEVE_DATA.get(orderKey);
    try {
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

async function saveListOrder(env: Bindings, order: string[]) {
    const prefix = getKeyPrefix(env);
    const orderKey = prefix + 'config:list_order';
    // Deduplicate and filter empty
    const unique = [...new Set(order)].filter(x => x);
    await env.SIEVE_DATA.put(orderKey, JSON.stringify(unique));
}

app.get('/api/lists', async (c) => {
    if (c.env.DEMO_MODE === 'true') {
        return c.json([]);
    }
    try {
        const prefix = getKeyPrefix(c.env);
        const listPrefix = prefix + 'list:';
        const list = await c.env.SIEVE_DATA.list({ prefix: listPrefix });
        const allNames = list.keys.map(k => k.name.substring(listPrefix.length));

        // Sort based on stored order
        const order = await getListOrder(c.env);

        // Create a Set for robust lookup
        const nameSet = new Set(allNames);

        // 1. Add items from 'order' that still exist in 'allNames'
        const sorted = order.filter(n => nameSet.has(n));

        // 2. Add remaining items from 'allNames' that weren't in 'order' (append to end)
        const sortedSet = new Set(sorted);
        allNames.forEach(n => {
            if (!sortedSet.has(n)) sorted.push(n);
        });

        return c.json(sorted);
    } catch(e) { return c.json([]); }
});

app.post('/api/lists/order', async (c) => {
    if (c.env.DEMO_MODE === 'true') return c.json({ error: "Demo Mode" }, 403);
    try {
        const newOrder = await c.req.json();
        if (!Array.isArray(newOrder)) return c.json({ error: "Invalid body" }, 400);
        await saveListOrder(c.env, newOrder);
        return c.json({ success: true });
    } catch(e) { return c.json({ error: (e as Error).message }, 500); }
});

app.get('/api/lists/:name', async (c) => {
    if (c.env.DEMO_MODE === 'true') {
        return c.notFound();
    }
    const prefix = getKeyPrefix(c.env);
    const name = c.req.param('name');
    const val = await c.env.SIEVE_DATA.get(prefix + 'list:' + name);
    if(val === null) return c.notFound();
    return c.text(val);
});

app.put('/api/lists/:name', async (c) => {
    if (c.env.DEMO_MODE === 'true') {
        return c.json({ error: "Demo Mode: Save disabled" }, 403);
    }
    const prefix = getKeyPrefix(c.env);
    const name = c.req.param('name');
    const content = await c.req.text();

    // update KV
    await c.env.SIEVE_DATA.put(prefix + 'list:' + name, content);

    // update Order if new
    const order = await getListOrder(c.env);
    if (!order.includes(name)) {
        order.push(name);
        await saveListOrder(c.env, order);
    }

    return c.json({ success: true });
});


app.delete('/api/lists/:name', async (c) => {
    if (c.env.DEMO_MODE === 'true') {
        return c.json({ error: "Demo Mode: Delete disabled" }, 403);
    }
    const prefix = getKeyPrefix(c.env);
    const name = c.req.param('name');
    await c.env.SIEVE_DATA.delete(prefix + 'list:' + name);

    // Remove from order
    const order = await getListOrder(c.env);
    const newOrder = order.filter(n => n !== name);
    if (newOrder.length !== order.length) {
        await saveListOrder(c.env, newOrder);
    }

    return c.json({ success: true });
});


app.get('/legend', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto;">
        <h1>Sieve Generator Legend</h1>
        <p><strong>Syntax Overview:</strong></p>
        <ul>
            <li><code>!alias1,alias2!CODE [Args]</code> - Alias Rules (Forwarded to you)</li>
            <li><code>!</code> - Start Scoped Section (Applies to emails delivered to <em>Folder Name</em>)</li>
            <li><code>global</code> - Start Global Section (Applies to all emails)</li>
            <li><code>Subject String CODE</code> - Subject Rule</li>
            <li><code>from:sender CODE</code> - Sender Rule</li>
        </ul>
        <p><strong>Codes:</strong></p>
        <ul>
            <li><code>F</code> - Default (File into Folder)</li>
            <li><code>FR</code> - Read (File + Mark Read)</li>
            <li><code>FRS</code> - Read Stop (File + Read + Stop Processing)</li>
            <li><code>FRA</code> - Read Archive (File + Read + Archive)</li>
            <li><code>FRAS</code> - Read Archive Stop</li>
            <li><code>B</code> - Bounce/Reject</li>
            <li><code>FRASD [Label]</code> - Custom Label (File to [Label], Mark Read, Archive, Stop)</li>
        </ul>
    </body>
    </html>
  `);
});

app.post('/generate', async (c) => {
    const { folderName, rulesInput } = await c.req.json();
    const buckets = parseRulesList(rulesInput);
    const script = generateSieveScript(folderName, buckets);
    return c.json({ script });
});

// --- Logic ---


// --- Helper Parsing Logic ---

function parseDSL(token) {
    if (!token) return null;
    
    let temp = token;
    let label = null;
    let expireRaw = null;
    
    // Extract inline label: !label!
    const labelMatch = temp.match(/!([\w-]+)!/);
    if (labelMatch) {
         label = labelMatch[1];
         temp = temp.replace(labelMatch[0], '');
    }
    
    // Extract expiration: xN[dh]
    const expireMatch = temp.match(/x(\d+)([dh]?)/i);
    if (expireMatch) {
        expireRaw = { val: expireMatch[1], unit: expireMatch[2] };
        temp = temp.replace(expireMatch[0], '');
    }
    
    // Check for "fsd:..." legacy pattern if token started with "fsd:"? 
    // No, standard loop splits by space. "fsd:label" is one token?
    // User syntax "FRASD label" is separate. "FSD label" is separate.
    // If token is "FSD", it is solely F,S,D flags.
    
    // Verify remaining characters are only flags [F, R, A, S, B, D]
    // Allowing case-insensitive
    if (temp.length > 0 && !/^[frasbd]+$/i.test(temp)) {
        return null; // Contains invalid chars
    }
    
    const flags = {
        F: /f/i.test(temp),
        R: /r/i.test(temp),
        A: /a/i.test(temp),
        S: /s/i.test(temp),
        B: /b/i.test(temp),
        D: /d/i.test(temp)
    };
    
    // Legacy support: "F" implies File. "B" implies Reject.
    // If ONLY Expiration was matched (e.g. "x1h"), assume File?
    // "x1h" -> temp="" -> flags.F = false.
    // We should probably default F=true unless B is present?
    // Or just encode exactly what was found and let generator decide defaults.
    // However, "x1h" usually means "File and Expire".
    // "R" means "File and Read".
    // So if B is NOT present, F is usually implicit?
    // But "A" (Archive) might mean *only* archive? No, usually "A" is separate from "F".
    // "F" is file-into-target. "A" is file-into-archive.
    // "FRA" -> File + Read + Archive.
    // "RA" -> Read + Archive (Maybe no File?).
    // "x1h" -> Expire + File?
    
    // Let's rely on explicit 'F' in token OR defaults.
    // If token matched standard code logic before (e.g. "FR"), it had F.
    // If "x1h", previously it was FX1h -> F is explicit.
    // If user types "x2h", is that valid? Matches logic.
    // Let's assume File is implicit if not Rejected/Bounced, 
    // OR we only set F if 'f' is in string.
    // BUT! The user said "AFx2h". Explicit A, F.
    // If they type "Ax2h", maybe they don't want File?
    // I will stick to explicit parsing.
    
    return {
        flags,
        expire: expireRaw,
        label,
        hasFlags: (temp.length > 0 || label !== null || expireRaw !== null)
    };
}

function canonicalSuffix(dsl) {
    if (!dsl) return 'default';
    
    const parts = [];
    
    // Auto-set F (File) if not Reject/Bounce.
    // This handles "Ax2h" vs "AFx2h" deduplication.
    const hasF = dsl.flags.F || !dsl.flags.B;

    // Flags
    if (hasF) parts.push('F');
    if (dsl.flags.R) parts.push('R');
    if (dsl.flags.A) parts.push('A');
    if (dsl.flags.S) parts.push('S');
    if (dsl.flags.B) parts.push('B');
    if (dsl.flags.D) parts.push('D');
    
    // Expire
    if (dsl.expire) {
        const u = (dsl.expire.unit || 'd').toLowerCase().startsWith('h') ? 'h' : 'd';
        parts.push(`X-${dsl.expire.val}-${u}`);
    }
    
    // Label
    if (dsl.label) {
        parts.push(`L-${dsl.label}`);
    }
    
    if (parts.length === 0) return 'default'; // Should match explicit "F"? No F is flag.
    // If empty (e.g. code ""), default.
    
    return 'auto:' + parts.join('_');
}

function parseRulesList(rawText) {
    const lines = rawText.split('\n');
    
    const context = {
        scope: 'global', 
    };
    
    const buckets = {};

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;

        // Alias Logic
        // Regex to extract alias part first: !alias1,alias2! ... rest
        let aliasMatch = line.match(/^!([^!]+)!(.*)$/);
        if (aliasMatch) {
             const aliases = aliasMatch[1].split(',').map(s => s.trim()).filter(s => s);
             const rest = aliasMatch[2].trim();
             
             // Now parse 'rest' for code + args.
             // e.g. "AFx2h remainder" or "remainder AFx2h"
             // or "Fx1"
             const parts = rest.split(/\s+/);
             const first = parts[0];
             const last = parts.length > 0 ? parts[parts.length - 1] : '';
             
             let suffix = 'default';
             let matchArgs = rest;
             
             const dslFirst = parseDSL(first);
             const dslLast = parseDSL(last);
             let dsl = null;
             
             // Prefer LAST if valid (standard "Pattern CODE" style, though legacy alias was "CODE Pattern")
             // Actually legacy alias was "CODE Pattern". So First is preferred for backward compat?
             // But Global logic prefers Last.
             // If "AFx2h remainder", First is code.
             // If "remainder AFx2h", Last is code.
             
             if (dslFirst && dslFirst.hasFlags) {
                 dsl = dslFirst;
                 matchArgs = rest.substring(first.length).trim();
             } else if (dslLast && dslLast.hasFlags) {
                 dsl = dslLast;
                 matchArgs = rest.substring(0, rest.length - last.length).trim();
             }
             
             // Handle "Designated" Label Logic (Legacy FSD support)
             if (dsl && dsl.flags.D && !dsl.label && matchArgs) {
                 // For Designated rules without an explicit inline label (!label!),
                 // treat the ENTIRE remaining argument string as the Label.
                 // This supports "FSD New Sender" -> Label="New Sender".
                 dsl.label = matchArgs;
                 matchArgs = ''; 
             }
             
             if (dsl) {
                 suffix = canonicalSuffix(dsl);
             } 
             
             // If we have remaining args, treat them as a Subject Match (Filter)
             // But only if they aren't empty
             if (matchArgs && matchArgs.length > 0) {
                 // Group by (Suffix + Alias-Set) to allow combining multiple filters for same alias
                 const aliasKey = aliases.sort().join(',');
                 const key = `aliases-filtered:${suffix}###${aliasKey}`;
                 if (!buckets[key]) buckets[key] = [];
                 buckets[key].push(matchArgs);
             } else {
                 const key = 'aliases:' + suffix;
                 if (!buckets[key]) buckets[key] = [];
                 buckets[key].push(...aliases);
             }
             continue; 
        }

        // Scope Switching
        if (line === '!' || line === 'scoped') {
            context.scope = 'scoped';
            continue;
        }
        if (line === 'global') {
            context.scope = 'global';
            continue;
        }
        
        let currentScope = context.scope;
        let currentLine = line;
        
        if (currentLine.startsWith('!')) {
            currentScope = 'scoped';
            currentLine = currentLine.substring(1).trim();
            if (!currentLine) {
                context.scope = 'scoped';
                continue;
            }
        } else if (currentLine.toLowerCase().startsWith('global ')) {
            currentScope = 'global';
            currentLine = currentLine.substring(7).trim();
        }

        let type = 'subject';
        if (currentLine.toLowerCase().startsWith('from:')) {
            type = 'from';
            currentLine = currentLine.substring(5).trim();
        }

        // Parse Code from Rule Line
        // "Subject String CODE" or "CODE Subject String"
        let bucketSuffix = 'auto:F'; // Default to File
        
        const parts = currentLine.split(/\s+/);
        const first = parts[0];
        const last = parts.length > 0 ? parts[parts.length - 1] : '';
        
        const dslFirst = parseDSL(first);
        const dslLast = parseDSL(last);
        
        let matchString = currentLine;
        
        // Prefer LAST if valid (standard "Pattern CODE")
        if (dslLast && dslLast.hasFlags) {
             bucketSuffix = canonicalSuffix(dslLast);
             matchString = currentLine.substring(0, currentLine.length - last.length).trim();
        } else if (dslFirst && dslFirst.hasFlags) {
             bucketSuffix = canonicalSuffix(dslFirst);
             matchString = currentLine.substring(first.length).trim();
        }
        
        const key = `${currentScope}-${type}-${bucketSuffix}`;
        if (!buckets[key]) buckets[key] = [];
        const item = matchString.trim();
        
        if (item) {
            buckets[key].push(item);
        }
    }
    
    return buckets;
}

function generateSieveScript(folderName, buckets) {
    const ruleName = folderName.trim() || "Default";
    const ruleNameLower = ruleName.toLowerCase();
    
    let script = `# Generated Sieve Script for ${ruleName}\n`;
    script += `require ["include", "environment", "variables", "relational", "comparator-i;ascii-numeric", "spamtest", "fileinto", "imap4flags", "vnd.proton.expire", "extlists", "reject"];\n\n`;
    
    script += `# Generated: Do not run this script on spam messages\n`;
    script += `if allof (environment :matches "vnd.proton.spam-threshold" "*", spamtest :value "ge" :comparator "i;ascii-numeric" "\${1}") {\n    return;\n}\n\n`;
    
    const splitMatches = (items) => {
        const contains = [];
        const matches = [];
        for (let item of items) {
            item = item.replace(/^"|"$/g, '');
            if (item.includes('*') || item.includes('?')) matches.push(`"${item}"`);
            else contains.push(`"${item}"`);
        }
        return { contains, matches };
    };

    // --- ALIASES ---
    // 1. Filtered Aliases (Specific rules first)
    const aliasFilteredKeys = Object.keys(buckets).filter(k => k.startsWith('aliases-filtered:'));
    
    if (aliasFilteredKeys.length > 0) {
        script += `# --- ALIAS RULES (FILTERED) ---\n\n`;
        for (const key of aliasFilteredKeys) {
            const part = key.substring('aliases-filtered:'.length);
            const [suffix, aliasStr] = part.split('###');
            const aliasList = aliasStr.split(',').map(a => `"${a}"`).join(', ');
            
            const filters = buckets[key];
            const { contains: subjectContains, matches: subjectMatches } = splitMatches(filters);
            
            const subjectConditions = [];
            if (subjectContains.length) subjectConditions.push(`header :comparator "i;unicode-casemap" :contains "Subject" [${subjectContains.join(', ')}]`);
            if (subjectMatches.length) subjectConditions.push(`header :comparator "i;unicode-casemap" :matches "Subject" [${subjectMatches.join(', ')}]`);
            
            if (subjectConditions.length === 0) continue; 
            const subjectBlock = subjectConditions.length > 1 ? `anyof (\n    ${subjectConditions.join(',\n    ')}\n  )` : subjectConditions[0];

            let body = getActionBody(suffix, ruleName);
            
            script += `# Aliases (Filtered) | ${suffix} | ${aliasStr}\n`;
            script += `if allof (\n`;
            script += `  header :comparator "i;unicode-casemap" :contains "X-Original-To" [${aliasList}],\n`;
            script += `  header :contains "Delivered-To" ["@"],\n`;
            script += `  ${subjectBlock}\n`;
            script += `) {\n  ${body}\n}\n\n`;
        }
    }

    // 2. Generic Aliases
    const aliasKeys = Object.keys(buckets).filter(k => k.startsWith('aliases:'));
    
    if (aliasKeys.length > 0) {
        script += `# --- ALIAS RULES (GENERIC) ---\n\n`;
        for (const key of aliasKeys) {
            const suffix = key.substring('aliases:'.length);
            const items = buckets[key];
            if (!items.length) continue;
            
            const { contains, matches } = splitMatches(items);
            const conditions = [];
            if (contains.length) conditions.push(`header :comparator "i;unicode-casemap" :contains "X-Original-To" [${contains.join(', ')}]`);
            if (matches.length) conditions.push(`header :comparator "i;unicode-casemap" :matches "X-Original-To" [${matches.join(', ')}]`);
            
            if (conditions.length === 0) continue;
            
            const matchBlock = conditions.length > 1 ? `anyof (\n    ${conditions.join(',\n    ')}\n  )` : conditions[0];
            
            let body = getActionBody(suffix, ruleName);
            
            script += `# Aliases | ${suffix}\n`;
            script += `if allof (\n  ${matchBlock},\n  header :contains "Delivered-To" ["@"]\n) {\n  ${body}\n}\n\n`;
        }
    }
    
    // --- GLOBAL ---
    const globalSubjectKeys = Object.keys(buckets).filter(k => k.startsWith('global-subject-'));
    const globalFromKeys = Object.keys(buckets).filter(k => k.startsWith('global-from-'));
    
    if (globalSubjectKeys.length || globalFromKeys.length) {
        script += `# --- GLOBAL RULES ---\n\n`;
        for (const key of globalSubjectKeys) {
            const suffix = key.substring('global-subject-'.length);
            const items = buckets[key];
            if (!items.length) continue;
            const { contains, matches } = splitMatches(items);
            const conditions = [];
            if (contains.length) conditions.push(`header :comparator "i;unicode-casemap" :contains "Subject" [${contains.join(', ')}]`);
            if (matches.length) conditions.push(`header :comparator "i;unicode-casemap" :matches "Subject" [${matches.join(', ')}]`);
            if (conditions.length === 0) continue;
            let body = getActionBody(suffix, ruleName);
            script += `# Global | Subject | ${suffix}\n`;
            script += `if anyof (\n  ${conditions.join(',\n  ')}\n) {\n  ${body}\n}\n\n`;
        }
        for (const key of globalFromKeys) {
            const suffix = key.substring('global-from-'.length);
            const items = buckets[key];
            if (!items.length) continue;
            const { contains, matches } = splitMatches(items);
            const conditions = [];
            
            // 1. Check standard "From" header using address test
            if (contains.length) conditions.push(`address :all :comparator "i;unicode-casemap" :contains "From" [${contains.join(', ')}]`);
            if (matches.length) conditions.push(`address :all :comparator "i;unicode-casemap" :matches "From" [${matches.join(', ')}]`);
            
            // 2. Check "X-Simplelogin-Original-From" as a text header
            if (contains.length) conditions.push(`header :comparator "i;unicode-casemap" :contains "X-Simplelogin-Original-From" [${contains.join(', ')}]`);
            if (matches.length) {
                // For header matching, we need to wrap the pattern in wildcards to match the full header string
                // e.g. "Name <email>" needs "*email*"
                const headerMatches = matches.map(m => {
                    const clean = m.substring(1, m.length - 1); // remove quotes
                    return `"*${clean}*"`;
                });
                conditions.push(`header :comparator "i;unicode-casemap" :matches "X-Simplelogin-Original-From" [${headerMatches.join(', ')}]`);
            }

            if (conditions.length === 0) continue;
            let body = getActionBody(suffix, ruleName);
            script += `# Global | From | ${suffix}\n`;
            script += `if anyof (\n  ${conditions.join(',\n  ')}\n) {\n  ${body}\n}\n\n`;
        }
    }
    
    // --- SCOPED ---
    const scopedSubjectKeys = Object.keys(buckets).filter(k => k.startsWith('scoped-subject-'));
    const scopedFromKeys = Object.keys(buckets).filter(k => k.startsWith('scoped-from-'));
    
    if (scopedSubjectKeys.length || scopedFromKeys.length) {
        script += `# --- SCOPED RULES ---\n`;
        script += `# Applies only when delivered to: ${ruleNameLower}...\n`;
        script += `if header :contains "X-Original-To" "${ruleNameLower}" {\n\n`;
        
        for (const key of scopedSubjectKeys) {
            const suffix = key.substring('scoped-subject-'.length);
            const items = buckets[key];
            if (!items.length) continue;
             const { contains, matches } = splitMatches(items);
            const conditions = [];
            if (contains.length) conditions.push(`header :comparator "i;unicode-casemap" :contains "Subject" [${contains.join(', ')}]`);
            if (matches.length) conditions.push(`header :comparator "i;unicode-casemap" :matches "Subject" [${matches.join(', ')}]`);
            let body = getActionBody(suffix, ruleName);
            body = body.split('\n').map(l => '  ' + l).join('\n');
            const conditionStr = conditions.join(',\n      ');
            script += `    # Scoped | Subject | ${suffix}\n`;
            script += `    if anyof (\n      ${conditionStr}\n    ) {\n      ${body}\n    }\n\n`;
        }
        
        for (const key of scopedFromKeys) {
            const suffix = key.substring('scoped-from-'.length);
            const items = buckets[key];
            if (!items.length) continue;
            const { contains, matches } = splitMatches(items);
            const conditions = [];

            // 1. Check standard "From" header using address test
            if (contains.length) conditions.push(`address :all :comparator "i;unicode-casemap" :contains "From" [${contains.join(', ')}]`);
            if (matches.length) conditions.push(`address :all :comparator "i;unicode-casemap" :matches "From" [${matches.join(', ')}]`);
            
            // 2. Check "X-Simplelogin-Original-From" as a text header
            if (contains.length) conditions.push(`header :comparator "i;unicode-casemap" :contains "X-Simplelogin-Original-From" [${contains.join(', ')}]`);
            if (matches.length) {
                const headerMatches = matches.map(m => {
                    const clean = m.substring(1, m.length - 1);
                    return `"*${clean}*"`;
                });
                conditions.push(`header :comparator "i;unicode-casemap" :matches "X-Simplelogin-Original-From" [${headerMatches.join(', ')}]`);
            }

            let body = getActionBody(suffix, ruleName);
            body = body.split('\n').map(l => '  ' + l).join('\n');
            const conditionStr = conditions.join(',\n      ');
            script += `    # Scoped | From | ${suffix}\n`;
            script += `    if anyof (\n      ${conditionStr}\n    ) {\n      ${body}\n    }\n\n`;
        }
        script += `}\n`;
    }
    
    return script;
}

// Deprecated: mapCodeToSuffix (Functionality moved to canonicalSuffix)

function getActionBody(suffix, ruleName) {
    // Check for new auto format
    if (suffix.startsWith('auto:')) {
        const content = suffix.substring(5);
        // content e.g. "F_R_A_X-1-h_L-label"
        const parts = content.split('_');
        
        let s = '';
        let fileIntoTarget = false;
        let markRead = false;
        let archive = false;
        let stop = false;
        let reject = false;
        let fileIntoLabel = null;
        let expire = null;
        
        parts.forEach(p => {
            if (p === 'F') fileIntoTarget = true;
            if (p === 'R') markRead = true;
            if (p === 'A') archive = true;
            if (p === 'S') stop = true;
            if (p === 'B') reject = true;
            if (p.startsWith('L-')) fileIntoLabel = p.substring(2);
            if (p.startsWith('X-')) {
                const [, val, unit] = p.split('-');
                expire = { val, unit: unit === 'h' ? 'hour' : 'day' };
            }
        });

        // Generate Sieve lines
        if (reject) {
            // Reject usually stops everything else
            return `reject "Message Rejected";\n  stop;`;
        }

        // Action Metadata (Flags, Expiration) must be set BEFORE fileinto
        if (markRead) {
            s += `addflag "\\\\Seen";\n  `;
        }
        
        if (expire) {
            s += `expire "${expire.unit}" "${expire.val}";\n  `;
        }
        
        if (archive) {
            s += `fileinto "Archive";\n  `;
        }
        
        // File into Target (Rule Name) or Label
        if (fileIntoTarget || fileIntoLabel) {
             const target = fileIntoLabel || ruleName;
             s += `fileinto "${target}";\n  `;
        }
        
        if (stop) {
            s += `stop;`;
        }
        
        return s.trim();
    }

    // Legacy fallback (Shouldn't be hit with new parser)
    if (suffix === 'default') return `fileinto "${ruleName}";`;
    if (suffix === 'read') return `fileinto "${ruleName}";\n  addflag "\\\\Seen";`;

    if (suffix === 'read-stop') return `fileinto "${ruleName}";\n  addflag "\\\\Seen";\n  stop;`;
    if (suffix === 'read-archive') return `fileinto "${ruleName}";\n  addflag "\\\\Seen";\n  fileinto "archive";`;
    if (suffix === 'read-archive-stop') return `fileinto "${ruleName}";\n  addflag "\\\\Seen";\n  fileinto "archive";\n  stop;`;
    if (suffix === 'expire') return `fileinto "${ruleName}";\n  expire "day" "1";\n  stop;`;
    if (suffix && suffix.startsWith('expire:')) {
        const parts = suffix.split(':');
        const num = parts[1];
        const unit = parts[2];
        const isRead = parts[3] === 'read';
        
        let codeBlock = `fileinto "${ruleName}";`;
        if (isRead) codeBlock += `\n  addflag "\\\\Seen";`;
        codeBlock += `\n  expire "${unit}" "${num}";\n  stop;`;
        return codeBlock;
    }
    if (suffix === 'reject') return `reject "This message was rejected by the mail delivery system.";\n  stop;`;
    if (suffix && suffix.startsWith('fsd:')) {
        const label = suffix.substring(4).trim();
        return `fileinto "${label}";\n  stop;`;
    }
    return `fileinto "${ruleName}";`;
}

export default app;
