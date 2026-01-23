
## Syntax Format

```text
[SCOPE] [TYPE] [ACTION] [PATTERN]
```

### 1. SCOPE (Optional)
Determines *where* the rule applies.
- **(No Prefix)**: **Global**. Applies to all emails delivered to the account, unless guarded by specific "Delivered-To" logic in the template.
- **`!`**: **Scoped**. Applies **only** if the email was originally addressed to the specific mailbox (e.g., `auto`, `alert`).
  - Example: `!> Subject Text` -> Matches only if header `X-Original-To` is `auto` (assuming we are in `auto` rule).

### 2. TYPE (Optional)
Determines *what part* of the email header to check.
- **(No Prefix)**: Check the **Subject** header.
- **`from:`**: Check the **From** header.

### 3. ACTION (Required)
A combination of characters that determine what happens when the pattern matches.

| Code | Meaning | Logic Applied |
| :--- | :--- | :--- |
| `F` | **FileInto** | Moves email to the folder. (Default behavior) |
| `R` | **Read** | Marks the email as seen (`\Seen`). |
| `A` | **Archive** | Moves email to the `Archive` folder (and the Rule folder). |
| `S` | **Stop** | Stops processing further Sieve scripts. |
| `x1` | **Expire** | Sets the email to expire in 1 day. |

#### Supported Combinations (Buckets)

**Subject Rules:**
*   `F` or `S`: Default (FileInto + Stop)
*   `FR`: Read + FileInto + Stop
*   `FRS`: Read + FileInto + Stop
*   `FRA`: Read + FileInto + Archive + Stop
*   `FRAS`: Read + FileInto + Archive + Stop
*   `Fx1`: Expire + FileInto + Stop

**From Rules:**
*   `from:FRS` (or just `from:FR`): Read + FileInto + Stop
*   `from:FRAS`: Read + FileInto + Archive + Stop

### 4. PATTERN (Required)
The text to match against the header.
- **Wildcards**: If the pattern contains `*` or `?`, the system automatically uses the Sieve `:matches` comparator.
- **Literal**: If no wildcards are present, the system uses the Sieve `:contains` comparator.

## Examples

| Rule Line | Explanation |
| :--- | :--- |
| `F Your Order Shipped` | **Global Subject**. Moves to folder if subject contains text. Stops. |
| `FR Daily Digest` | **Global Subject**. Moves to folder, marks as **Read**. Stops. |
| `FRAS Security Alert` | **Global Subject**. Moves to folder, marks **Read**, copies to **Archive**. Stops. |
| `from:FRS info@example.com` | **Global From**. Moves to folder if sender matches. Marks Read. Stops. |
| `!F Local Only` | **Scoped Subject**. Moves to folder ONLY if sent specifically to this mailbox. |
| `!from:FRAS bad-actor@spam` | **Scoped From**. Read/Archive/Stop ONLY if sent to this mailbox. |
| `Fx1 Temporary Code` | **Global Subject**. Moves to folder, sets **Expire in 1 day**. |
| `F *Verification*` | **Global Subject**. Uses `:matches` because of wildcards. |

## Invalid/Strict Mode
Any line that does not start with a valid action code (like `F`) is considered **Invalid** and will be skipped with a warning during the build process. You must be explicit.
