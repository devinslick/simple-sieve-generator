
import { Hono } from 'hono';
type Bindings = {
  SIEVE_DATA: KVNamespace
  DEMO_MODE?: string
}

const app = new Hono<{ Bindings: Bindings }>()

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
            .controls-row { flex-direction: column; }
            .controls-row select, .controls-row button { width: 100%; }
            h1 { font-size: 1.5rem; }
            body { padding: 0.75rem; }
          }
        </style>
        <script>
            // --- UI LOGIC ---
            const IS_DEMO = ${isDemo};

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
                        const lists = await res.json();
                        const selector = document.getElementById('savedLists');
                        selector.innerHTML = '<option value="">-- Load Saved List --</option>' + 
                            lists.map(l => \`<option value="\${l}">\${l}</option>\`).join('');
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
                    await fetch(\`/api/lists/\${name}\`, { method: 'PUT', body: content });
                    alert('Saved as "' + name + '"!');
                    loadListNames(); 
                    // Set dropdown to this new name if exists
                    document.getElementById('savedLists').value = name;
                } catch(e) { alert('Error saving: ' + e.message); }
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
                    await fetch(\`/api/lists/\${name}\`, { method: 'DELETE' });
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
                
                const res = await fetch(\`/api/lists/\${name}\`);
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
            };
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
                 <button onclick="saveCurrentList()">Save Current</button>
                 <button onclick="deleteCurrentList()" class="btn-danger">Delete Selected</button>
             </div>
        </div>

        <div>
          <label for="folderName">Folder Name / List Name (e.g. "Shopping"):</label>
          <input type="text" id="folderName" value="Shopping">
        </div>
        
        <div>
          <label for="rulesInput">Rules List: <a href="/legend" target="_blank" style="font-size: 0.9em; color: var(--primary); text-decoration: none;">(View Legend)</a></label>
          <textarea id="rulesInput" placeholder="!alias1,alias2!FRASD deal&#10;!scope&#10;Subject Rule F&#10;from:sender@example.com FR"></textarea>
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

app.get('/api/lists', async (c) => {
    if (c.env.DEMO_MODE === 'true') {
        return c.json([]);
    }
    try {
        const list = await c.env.SIEVE_DATA.list({ prefix: 'list:' });
        return c.json(list.keys.map(k => k.name.substring(5))); // remove 'list:' prefix
    } catch(e) { return c.json([]); }
});

app.get('/api/lists/:name', async (c) => {
    if (c.env.DEMO_MODE === 'true') {
        return c.notFound();
    }
    const name = c.req.param('name');
    const val = await c.env.SIEVE_DATA.get('list:' + name);
    if(val === null) return c.notFound();
    return c.text(val);
});

app.put('/api/lists/:name', async (c) => {
    if (c.env.DEMO_MODE === 'true') {
        return c.json({ error: "Demo Mode: Save disabled" }, 403);
    }
    const name = c.req.param('name');
    const content = await c.req.text();
    await c.env.SIEVE_DATA.put('list:' + name, content);
    return c.json({ success: true });
});


app.delete('/api/lists/:name', async (c) => {
    if (c.env.DEMO_MODE === 'true') {
        return c.json({ error: "Demo Mode: Delete disabled" }, 403);
    }
    const name = c.req.param('name');
    await c.env.SIEVE_DATA.delete('list:' + name);
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

function parseRulesList(rawText) {
    const lines = rawText.split('\n');
    
    const context = {
        scope: 'global', // 'global' or 'scoped'
    };
    
    const buckets = {};

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;

        // Alias Check (Stateless)
        const aliasMatch = line.match(/^!([^!]+)!(\w+)(?:\s+(.+))?$/);
        if (aliasMatch) {
             const aliases = aliasMatch[1].split(',').map(s => s.trim()).filter(s => s);
             const code = aliasMatch[2].toUpperCase();
             const args = aliasMatch[3] ? aliasMatch[3].trim() : '';
             let suffix = 'default';
             if (['F', 'STOP', 'S', '>'].includes(code)) suffix = 'default';
             else if (code === 'FR') suffix = 'read';
             else if (code === 'FRS') suffix = 'read-stop';
             else if (code === 'FRA') suffix = 'read-archive';
             else if (code === 'FRAS') suffix = 'read-archive-stop';
             else if (code === 'FX1') suffix = 'expire';
             else if (code === 'B') suffix = 'reject';
             else if (code === 'FRASD') {
                 if (!args) continue;
                 suffix = args.trim();
             }
             else if (code === 'FSD') {
                 if (!args) continue;
                 suffix = 'fsd:' + args.trim();
             }
             const key = 'aliases:' + suffix;
             if (!buckets[key]) buckets[key] = [];
             buckets[key].push(...aliases);
             continue; 
        }

        // Scope Switching Commands
        if (line === '!' || line === 'scoped') {
            context.scope = 'scoped';
            continue;
        }
        if (line === 'global') {
            context.scope = 'global';
            continue;
        }
        
        // Single line handling
        // If line starts with "!", explicit scope switch for this line?
        // Original logic: "if (line.startsWith('!')) { scope = 'scoped'; line = line.substring(1)... }"
        let currentScope = context.scope;
        let currentLine = line;
        
        if (currentLine.startsWith('!')) {
            currentScope = 'scoped';
            currentLine = currentLine.substring(1).trim();
            // If line was just "!", we already handled it? No, if "!" is followed by content.
            if (!currentLine) {
                // Just a switch
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

        // Parse Code
        let bucketSuffix = 'default';
        const parts = currentLine.split(/\s+/);
        const possibleCode = parts[0] ? parts[0].toUpperCase() : '';
        const standardCodes = ['F', 'STOP', 'S', '>', 'FR', 'FRS', 'FRA', 'FRAS', 'FX1', 'B'];
        
        let matchString = currentLine;
        
        // Check if starts with code (Example: "F String" - wait, does user type code first?)
        // Legend says: "Subject String CODE" -> Code is LAST.
        // But logic says: "if includes(code)"... 
        // Let's support BOTH.
        
        // Check LAST part first (Common usage usually "Subject matchstring F")
        const lastPart = parts.length > 0 ? parts[parts.length - 1].toUpperCase() : '';
        if (standardCodes.includes(lastPart)) {
             bucketSuffix = mapCodeToSuffix(lastPart, type);
             matchString = currentLine.substring(0, currentLine.length - lastPart.length).trim();
        } else if (standardCodes.includes(possibleCode)) {
             // Check FIRST part
             bucketSuffix = mapCodeToSuffix(possibleCode, type);
             matchString = currentLine.substring(possibleCode.length).trim();
        }
        
        const key = `${currentScope}-${type}-${bucketSuffix}`;
        if (!buckets[key]) buckets[key] = [];
        // Treat the rest of the line as a single pattern (preserve commas)
        const item = matchString.trim();
        if (item) {
            buckets[key].push(item);
        }
    }
    
    return buckets;
}

function mapCodeToSuffix(code, type) {
    if (['F', 'STOP', 'S', '>'].includes(code)) return 'default';
    if (code === 'FR') return type === 'from' ? 'read-stop' : 'read'; // Legacy quirk
    if (code === 'FRS') return 'read-stop';
    if (code === 'FRA') return 'read-archive';
    if (code === 'FRAS') return 'read-archive-stop';
    if (code === 'FX1') return 'expire';
    if (code === 'B') return 'reject';
    return 'default';
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
    const aliasKeys = Object.keys(buckets).filter(k => k.startsWith('aliases:'));
    
    if (aliasKeys.length > 0) {
        script += `# --- ALIAS RULES ---\n\n`;
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
            
            let body = '';
            if (suffix === 'default') body = `fileinto "${ruleName}";`;
            else if (suffix === 'read') body = `fileinto "${ruleName}";\n  addflag "\\\\Seen";`;
            else if (suffix === 'read-stop') body = `fileinto "${ruleName}";\n  addflag "\\\\Seen";\n  stop;`;
            else if (suffix === 'read-archive') body = `fileinto "${ruleName}";\n  addflag "\\\\Seen";\n  fileinto "archive";`;
            else if (suffix === 'read-archive-stop') body = `fileinto "${ruleName}";\n  addflag "\\\\Seen";\n  fileinto "archive";\n  stop;`;
            else if (suffix === 'expire') body = `fileinto "${ruleName}";\n  expire "day" "1";\n  stop;`;
            else if (suffix === 'reject') body = `reject "This message was rejected by the mail delivery system.";\n  stop;`;
            else if (suffix.startsWith('fsd:')) {
                const label = suffix.substring(4).trim();
                body = `fileinto "${label}";\n  stop;`;
            }
            else {
                const label = suffix;
                body = `fileinto "${label}";\n  addflag "\\\\Seen";\n  fileinto "archive";\n  stop;`;
            }
            
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
            if (contains.length) conditions.push(`address :all :comparator "i;unicode-casemap" :contains ["From"] [${contains.join(', ')}]`);
            if (matches.length) conditions.push(`address :all :comparator "i;unicode-casemap" :matches ["From"] [${matches.join(', ')}]`);
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
            if (contains.length) conditions.push(`address :all :comparator "i;unicode-casemap" :contains ["From"] [${contains.join(', ')}]`);
            if (matches.length) conditions.push(`address :all :comparator "i;unicode-casemap" :matches ["From"] [${matches.join(', ')}]`);
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

function getActionBody(suffix, ruleName) {
    if (suffix === 'default') return `fileinto "${ruleName}";`;
    if (suffix === 'read') return `fileinto "${ruleName}";\n  addflag "\\\\Seen";`;
    if (suffix === 'read-stop') return `fileinto "${ruleName}";\n  addflag "\\\\Seen";\n  stop;`;
    if (suffix === 'read-archive') return `fileinto "${ruleName}";\n  addflag "\\\\Seen";\n  fileinto "archive";`;
    if (suffix === 'read-archive-stop') return `fileinto "${ruleName}";\n  addflag "\\\\Seen";\n  fileinto "archive";\n  stop;`;
    if (suffix === 'expire') return `fileinto "${ruleName}";\n  expire "day" "1";\n  stop;`;
    if (suffix === 'reject') return `reject "This message was rejected by the mail delivery system.";\n  stop;`;
    return `fileinto "${ruleName}";`;
}

export default app;
