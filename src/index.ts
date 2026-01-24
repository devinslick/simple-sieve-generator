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
        
        <div style="position:fixed; bottom:5px; right:5px; font-size:10px; color:#aaa;">App Version: 1.3 (Bounce Support)</div>

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
              // Add timestamp to prevent browser caching
              const res = await fetch(\`/api/\${type}?t=\${Date.now()}\`, { signal: controller.signal });
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
            
            const legendHtml = type === 'lists' ? \`
              <br><br>
              <details>
                <summary style="cursor:pointer; font-weight:bold;">Show Rules Legend / DSL Syntax</summary>
                <div style="background:#f9f9f9; padding:15px; border:1px solid #ddd; margin-top:10px; font-size:0.9em; line-height:1.4;">
                  <h4>Syntax: <code>[SCOPE] [TYPE] [ACTION] [PATTERN]</code></h4>
                  
                  <p><strong>1. SCOPE:</strong> Where the rule applies.</p>
                  <ul>
                    <li>(None) = Global (All emails) &rarr; <code>global-*</code></li>
                    <li><code>!</code> = Scoped (Only specific mailbox) &rarr; <code>scoped-*</code></li>
                  </ul>

                  <p><strong>2. TYPE:</strong> Header to check.</p>
                  <ul>
                    <li>(None) = Subject &rarr; <code>*-subject-*</code></li>
                    <li><code>from:</code> = From header &rarr; <code>*-from-*</code></li>
                  </ul>

                  <p><strong>3. ACTION:</strong> Maps to template variable suffixes.</p>
                  <table border="1" style="border-collapse:collapse; width:100%; margin-bottom:10px;">
                    <tr style="background:#eee;"><th>Code</th><th>Effect</th><th>Variable Suffix</th></tr>
                    <tr><td><code>F</code>, <code>S</code></td><td>FileInto / Stop</td><td><code>*-default</code></td></tr>
                    <tr><td><code>FR</code></td><td>Mark as Read</td><td><code>*-read</code></td></tr>
                    <tr><td><code>FRS</code></td><td>Read + Stop</td><td><code>*-read-stop</code></td></tr>
                    <tr><td><code>FRA</code></td><td>Read + Archive</td><td><code>*-read-archive</code></td></tr>
                    <tr><td><code>FRAS</code></td><td>Read + Archive + Stop</td><td><code>*-read-archive-stop</code></td></tr>
                    <tr><td><code>FRASD [label]</code></td><td>Designated (FRAS)</td><td><code>aliases-[label]</code></td></tr>
                    <tr><td><code>Fx1</code></td><td>Expire in 1 day</td><td><code>*-expire</code></td></tr>
                    <tr><td><code>B</code></td><td>Bounce (Reject)</td><td><code>*-reject</code></td></tr>
                  </table>
                  
                  <h4>Examples:</h4>
                  <ul>
                    <li><code>F Text</code> &rarr; <code>global-subject-default</code></li>
                    <li><code>FR Text</code> &rarr; <code>global-subject-read</code></li>
                    <li><code>!FRA Text</code> &rarr; <code>scoped-subject-read-archive</code></li>
                    <li><code>from:FRS user@ex.com</code> &rarr; <code>global-from-read-stop</code></li>
                    <li><code>B bad-spam</code> &rarr; <code>global-subject-reject</code></li>
                  </ul>
                  
                  <p><em>Use these variable names (e.g. <code>{{LIST:global-subject-read}}</code>) in your templates.</em></p>
                </div>
              </details>
            \` : '';

            app.innerHTML = \`
              <h3>\${isNew ? 'Creating' : 'Editing'}: \${key}</h3>
              <textarea id="editorContent">\${content}</textarea><br><br>
              <button onclick="saveItem('\${type}', '\${key}')">Save</button>
              \${!isNew ? \`<button onclick="deleteItem('\${type}', '\${key}')" style="background-color: #ff4444; color: white;">Delete</button>\` : ''}
              <button onclick="setView('\${type}')">Back</button>
              \${legendHtml}
            \`;
          }

          async function saveItem(type, key) {
            const content = document.getElementById('editorContent').value;
            await fetch(\`/api/\${type}/\${key}\`, { method: 'PUT', body: content });
            alert('Saved!');
            // Small delay to allow KV propagation
            setTimeout(() => setView(type), 1000);
          }

          async function deleteItem(type, key) {
            if (!confirm(\`Delete \${key}?\`)) return;
            await fetch(\`/api/\${type}/\${key}\`, { method: 'DELETE' });
            setView(type);
          }

          async function renderGenerator() {
            const [tRes, lRes] = await Promise.all([
               fetch('/api/templates'),
               fetch('/api/lists')
            ]);
            
            const templates = await tRes.json();
            const lists = await lRes.json();
            
            // Filter top-level lists (no slashes) for cleaner UI?
            // User likely wants 'bills', not 'bills/foo'.
            // Actually, showing all is safer, but highlighting simple names is better.
            const sortedLists = lists.sort();
            
            const app = document.getElementById('app');
            app.innerHTML = \`
              <h2>Generate Sieve Script</h2>
              
              <div style="background: #eef; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                 <p style="margin-top:0"><strong>How to use:</strong></p>
                 <ol style="margin-bottom:0; padding-left: 20px;">
                    <li>Select the <strong>Source List</strong> (e.g. <code>bills</code>) containing your rules.</li>
                    <li>Select the <strong>Template</strong> to use.</li>
                    <li>The generator will parse the list and map variables automatically.</li>
                 </ol>
              </div>

              <div>
                <label>Source List:</label><br>
                <select id="genList">
                  <option value="">-- Select List --</option>
                  \${sortedLists.map(l => \`<option value="\${l}">\${l}</option>\`).join('')}
                </select>
              </div>
              <br>
              <div>
                <label>Template:</label><br>
                <select id="genTemplate">
                  \${templates.map(t => \`<option value="\${t}">\${t}</option>\`).join('')}
                </select>
              </div>
              <br>
              <button onclick="generateScript()">Generate</button>
              <br><br>
              <textarea id="genOutput" placeholder="Generated script will appear here..."></textarea>
              <br><br>
              <div id="genLogs" style="font-family:monospace; font-size: 0.8em; color: #555; background: #f0f0f0; padding: 5px; border: 1px solid #ccc; max-height: 200px; overflow-y: auto;">Ready.</div>
            \`;
          }
          
          // --- DSL Parsing Logic ---
          function parseRulesList(rawText) {
             const buckets = {};
             const lines = rawText.split('\\n');
             
             for (let line of lines) {
                 line = line.trim();
                 if (!line || line.startsWith('#')) continue;

                 // 0. Check for Alias List Syntax: !alias1,alias2!CODE Pattern
                 // Example: !auto,credit!FRAS *
                 // Allow whitespace around the separator !
                 const aliasMatch = line.match(/^!\s*([^!]+)\s*!\s*([a-zA-Z0-9]+)(?:\s+(.+))?$/);
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
                         if (!args) {
                             console.warn('FRASD requires an argument (e.g. !FRASD deal). Skipping.');
                             continue;
                         }
                         suffix = args.toLowerCase();
                     }
                     
                     const key = 'aliases-' + suffix;
                     if (!buckets[key]) buckets[key] = [];
                     buckets[key].push(...aliases);
                     continue;
                 }
                 
                 let scope = 'global';
                 let type = 'subject';
                 let bucketSuffix = 'default';
                 
                 // 1. Consume Scope '!'
                 if (line.startsWith('!')) {
                     scope = 'scoped';
                     line = line.substring(1).trim();
                 } else if (line.startsWith('global ')) {
                     // explicit global? valid per some legends
                     scope = 'global'; 
                     line = line.substring(7).trim();
                 }
                 
                 // 2. Consume Type 'from:'
                 if (line.toLowerCase().startsWith('from:')) {
                     type = 'from';
                     line = line.substring(5).trim();
                 }
                 
                 // 3. Consume Action Code
                 // We split by space to get the first token
                 const parts = line.split(/\\s+/);
                 const code = parts[0].toUpperCase();
                 let consumedCode = false;
                 
                 // Mapping Codes to Bucket Suffixes
                 // Suffixes: default, read, read-stop, read-archive, read-archive-stop, expire, reject
                 if (['F', 'Stop', 'S', '>'].includes(code)) {
                     bucketSuffix = 'default';
                     consumedCode = true;
                 } else if (code === 'FR') {
                     // Read
                     bucketSuffix = 'read';
                     if (type === 'from') bucketSuffix = 'read-stop'; 
                 } else if (code === 'FRS') {
                     bucketSuffix = 'read-stop';
                     consumedCode = true;
                 } else if (code === 'FRA') {
                     bucketSuffix = 'read-archive';
                     consumedCode = true;
                 } else if (code === 'FRAS') {
                     bucketSuffix = 'read-archive-stop';
                     consumedCode = true;
                 } else if (code === 'FX1') {
                     bucketSuffix = 'expire';
                     consumedCode = true;
                 } else if (code === 'B') {
                     // New: Bounce (Reject)
                     bucketSuffix = 'reject';
                     consumedCode = true;
                 }
                 
                 // If we consumed a code, remove it from line
                 // If NOT consumed (e.g. pattern started with "Financial"), bucketSuffix stays 'default'
                 // We only consume if we matched a known code.
                 
                 if (consumedCode) {
                    // Remove first token
                    line = line.substring(parts[0].length).trim();
                 }
                 
                 // 4. Construct Bucket Key
                 const key = scope + '-' + type + '-' + bucketSuffix;
                 
                 if (!buckets[key]) buckets[key] = [];
                 buckets[key].push(line);
             }
             
             return buckets;
          }

          async function generateScript() {
            const templateName = document.getElementById('genTemplate').value;
            const ruleName = document.getElementById('genList').value;
            const logArea = document.getElementById('genLogs');
            
            const log = (msg) => {
               logArea.innerHTML += '<div>' + new Date().toLocaleTimeString() + ': ' + msg + '</div>';
               logArea.scrollTop = logArea.scrollHeight;
            };

            logArea.innerHTML = 'Starting generation...';
            
            if (!templateName || !ruleName) {
              alert('Please select a list source and a template.');
              return;
            }

            try {
              // 1. Fetch Template
              const tRes = await fetch(\`/api/templates/\${templateName}\`);
              let content = await tRes.text();
              log('Template loaded (' + content.length + ' chars).');

              // 2. Identify Variables
              const regex = /\{\{\\s*LIST:([-a-zA-Z0-9_\\/]+)(?::([a-zA-Z0-9_]+))?\\s*\}\}/g;
              const requiredLists = new Set();
              let match;
              while ((match = regex.exec(content)) !== null) {
                requiredLists.add(match[1]);
              }
              
              const requiredArr = Array.from(requiredLists);
              log('Template requires ' + requiredArr.length + ' variables.');

              // 3. Parse Main Rule List (The DSL File)
              let parsedBuckets = {};
              try {
                  const mainListRes = await fetch(\`/api/lists/\${encodeURIComponent(ruleName)}\`);
                  if (mainListRes.ok) {
                      const text = await mainListRes.text();
                      parsedBuckets = parseRulesList(text);
                      const keys = Object.keys(parsedBuckets);
                      const keyCount = keys.length;
                      const itemCount = Object.values(parsedBuckets).reduce((a,b) => a + b.length, 0);
                      log(\`Parsed Rule List '\${ruleName}': \${itemCount} items in \${keyCount} categories.\`);
                      log(\`Categories found: \${keys.join(', ')}\`);
                  } else {
                      log(\`Rule List '\${ruleName}' not found. Will rely on sub-lists/globals only.\`);
                  }
              } catch (err) {
                  log('Error parsing rule list: ' + err.message);
              }

              // 4. Fetch/Resolve Lists
              const listCache = {};
              
              for (const varName of requiredLists) {
                // Priority 1: Parsed Bucket from Main List
                if (parsedBuckets[varName] && parsedBuckets[varName].length > 0) {
                    listCache[varName] = parsedBuckets[varName];
                    log(\`Mapped '\${varName}' from parsed rule list.\`);
                    continue; // Skip fetch
                }
                
                // Priority 2: Specific Rule/Var List
                const specificKey = \`\${ruleName}/\${varName}\`;
                let res = await fetch(\`/api/lists/\${encodeURIComponent(specificKey)}\`);
                let usedKey = specificKey;
                
                // Priority 3: Global/Fallback List
                if (!res.ok) {
                    res = await fetch(\`/api/lists/\${encodeURIComponent(varName)}\`);
                    usedKey = varName;
                }
                
                if (res.ok) {
                   const text = await res.text();
                   const items = text.split('\\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
                   listCache[varName] = items;
                   log(\`Loaded external data for '\${varName}' from '\${usedKey}'.\`);
                } else {
                   listCache[varName] = []; 
                   // Only warn if we didn't find it in the bucket either
                   // (Implicitly handled since we are here)
                   // log(\`Warning: No data for '\${varName}'.\`);
                }
              }

              // 5. Replace Tags
              regex.lastIndex = 0; 
              content = content.replace(regex, (m, varName, mode) => {
                 let items = listCache[varName] || [];
                 const originalCount = items.length;
                 
                 // Mode filtering
                 if (mode === 'contains') {
                   items = items.filter(i => !i.includes('*') && !i.includes('?'));
                 } else if (mode === 'matches') {
                   items = items.filter(i => i.includes('*') || i.includes('?'));
                 }
                 
                 if (items.length === 0) {
                    // if (originalCount > 0) log('Variable "' + varName + '" filtered to 0 items by mode "' + mode + '". using __IGNORE__.');
                    return '"__IGNORE__"';
                 }
                 
                 return items.map(i => \`"\${i.replace(/"/g, '\\\\\\\\"')}"\`).join(', ');
              });
              log('Tags replaced. Done.');

              // 5.5. Inject Dynamic FRASD Blocks
              // Detect any aliases-xyz buckets that were populated but NOT used in the template (because we haven't replaced them yet)
              // This allows !FRASD shopping to work automatically without editing the template.
              
              const dynamicBlocks = [];
              const bucketKeys = Object.keys(parsedBuckets);
              
              for (const key of bucketKeys) {
                  if (key.startsWith('aliases-')) {
                    const suffix = key.substring(8); // 'shopping' from 'aliases-shopping'
                    const standardSuffixes = ['default', 'read', 'read-stop', 'read-archive', 'read-archive-stop', 'expire', 'reject'];
                    
                    // If it's a dynamic suffix (not one of the standard ones we hardcoded in the template)
                    if (!standardSuffixes.includes(suffix)) {
                         log(\`Generating dynamic block for destination '\${suffix}'...\`);
                         
                         // Get the list items directly
                         const items = parsedBuckets[key];
                         if (!items || items.length === 0) continue;
                         
                         // Create the lists
                         // We assume "contains" and "matches" separation logic here just like standard vars
                         const containsList = items.filter(i => !i.includes('*') && !i.includes('?')).map(i => \`"\${i.replace(/"/g, '\\\\\\\\"')}"\`).join(', ');
                         const matchesList = items.filter(i => i.includes('*') || i.includes('?')).map(i => \`"\${i.replace(/"/g, '\\\\\\\\"')}"\`).join(', ');

                         // Build the Sieve Block
                         // Note: We use Title Case for the folder name (e.g. "shopping" -> "Shopping")
                         const folderName = suffix.charAt(0).toUpperCase() + suffix.slice(1);
                         
                         let conditions = [];
                         if (containsList.length > 0) conditions.push(\`header :comparator "i;unicode-casemap" :contains "X-Original-To" [\${containsList}]\`);
                         if (matchesList.length > 0) conditions.push(\`header :comparator "i;unicode-casemap" :matches "X-Original-To" [\${matchesList}]\`);
                         
                         if (conditions.length > 0) {
                             const block = \`
# Dynamic Alias | Designated (\${folderName})
if allof (
  anyof (
    \${conditions.join(',\\n    ')}
  ),
  header :contains "Delivered-To" ["@"]
) {
  fileinto "\${folderName}";
  addflag "\\\\Seen";
  fileinto "archive";
  stop;
}
\`;
                             dynamicBlocks.push(block);
                         }
                    }
                  }
              }

              // Prepend dynamic blocks to the content (or append? Prepend usually better for aliases)
              // Actually, standard alias rules are normally at the top. Let's insert them after the header.
              
              if (dynamicBlocks.length > 0) {
                  // Find insertion point - after "require" or header comments
                  // Simple hack: Look for the first "if" statement and insert before it, 
                  // or just append to the generated alias section if we can find it.
                  
                  // Let's try to insert after the standard alias headers if possible, 
                  // otherwise just at the start of the rules.
                  
                  const aliasMarker = '# --- ALIAS RULES ---';
                  if (content.includes(aliasMarker)) {
                      content = content.replace(aliasMarker, aliasMarker + '\\n' + dynamicBlocks.join('\\n'));
                  } else {
                      // Just append to top after require
                      const requireEnd = content.indexOf(';');
                      if (requireEnd > -1) {
                          content = content.slice(0, requireEnd + 1) + '\\n\\n' + dynamicBlocks.join('\\n') + '\\n' + content.slice(requireEnd + 1);
                      } else {
                          content = dynamicBlocks.join('\\n') + '\\n' + content;
                      }
                  }
              }

              // 6. Prune Empty Rules
              // Remove blocks where "__IGNORE__" is the only thing in the list strings, OR inside known static headers.
              
              // IMPROVED REGEX:
              // 1. Matches optional comment lines preceding the block.
              // 2. Matches 'if anyof/allof (...) {'.
              // 3. Matches body.
              // 4. Matches closing brace '}' ONLY if it is at the start of a line (with optional whitespace).
              // This prevents matchng too early on nested braces (mostly).
              
              const blockRegex = new RegExp('(?:^\\\\s*#.*?\\\\n)?\\\\s*if (?:anyof|allof)\\\\s*\\\\(([\\\\s\\\\S]*?)\\\\)\\\\s*\\\\{[\\\\s\\\\S]*?\\\\n\\\\s*\\\\}', 'gm');
              
              content = content.replace(blockRegex, (fullBlock, conditionBody) => {
                  const listMatches = conditionBody.match(new RegExp('\\\\\[(.*?)\\\\\]', 'g'));
                  
                  if (!listMatches) return fullBlock;
                  
                  let hasActiveList = false;
                  
                  const ignoredHeaders = new Set([
                      'From', 'Subject', 'To', 'Cc', 'Bcc', 
                      'Sender', 'Resent-From', 'Date',
                      'X-Original-To', 'Delivered-To'
                  ]);

                  for (const listStr of listMatches) {
                      if (listStr.includes('"__IGNORE__"')) continue;

                      const innerContent = listStr.replace(/^\[\s*|\s*\]$/g, '');
                      const items = innerContent.split(',').map(s => s.trim());
                      
                      let isListActive = false;
                      for (const item of items) {
                          const cleanItem = item.replace(/^"|"$/g, '');
                          if (!ignoredHeaders.has(cleanItem)) {
                              isListActive = true;
                              break;
                          }
                      }
                      
                      if (isListActive) {
                          hasActiveList = true;
                          break;
                      }
                  }
                  
                  if (!hasActiveList) {
                      return ''; 
                  }
                  
                  return fullBlock;
              });

              // 6.5 Fix Broken Blocks (Nested Pruning Artifacts)
              // Sometimes pruning leaves weird artifacts if braces were mismatched or nested incorrectly.

              // 7. Cleanup extra newlines
              content = content.replace(/\\n\s*\\n\s*\\n/g, '\\n\\n');

              // 8. Replace Rule Name
              const titleCase = ruleName.replace(/\\w\\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
              content = content.replace(/\{\{RULE_NAME\}\}/g, titleCase);
              content = content.replace(/\{\{RULE_NAME_LOWER\}\}/g, ruleName.toLowerCase());

              document.getElementById('genOutput').value = content;
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
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
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
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  return c.text(val)
})

app.get('/api/templates/:key', async (c) => {
  const key = c.req.param('key')
  const val = await c.env.SIEVE_DATA.get('template:' + key)
  if (val === null) return c.notFound()
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
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
