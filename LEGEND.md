
## Syntax Format

```text
[SCOPE] [TYPE] [ACTION] [PATTERN]
```

### 1. SCOPE (Optional)
Determines *where* the rule applies.
- **(No Prefix)**: **Global**. Applies to all emails delivered to the account, unless guarded by specific "Delivered-To" logic in the template.
- **`!`** or **`scoped`**: **Scoped**. Applies **only** if the email was originally addressed to the specific mailbox (e.g., `auto`, `alert`).
  - Example: `!F Subject Text` -> Matches only if header `X-Original-To` matches the folder name.
- **`global`**: Switch back to **Global** scope after entering scoped mode.
  - Example: Use `global` on a line by itself to return to global scope for subsequent rules.

### 2. TYPE (Optional)
Determines *what part* of the email header to check.
- **(No Prefix)**: Check the **Subject** header.
- **`^sender@example.com^`**: (Preferred) Check the **From** header using an inline token. Place the `^...^` token anywhere in the rule line; remaining text is treated as the Subject filter. Example: `^sender@example.com^ FR Subject Text`.



### 3. ACTION (Required)
A combination of characters that determine what happens when the pattern matches.

| Code | Meaning | Logic Applied |
| :--- | :--- | :--- |
| `F` | **FileInto** | Moves email to the folder. (Default behavior) |
| `R` | **Read** | Marks the email as seen (`\Seen`). |
| `A` | **Archive** | Moves email to the `Archive` folder (and the Rule folder). |
| `S` | **Stop** | Stops processing further Sieve scripts. |
| `&label&` | **label** | Set the label for messages matching this rule. Defaults to the name of the rule list. |
| `B` | **Bounce** | Rejects the message with an error. |
| `x[N][u]` | **Expire** | Sets expiration. `x1`=1 day. `x6h`=6 hours. `x30d`=30 days. |

#### Supported Combinations (Buckets)

**Subject Rules:**
*   `F`: FileInto (Moves to folder)
*   `S`: FileInto + Stop
*   `FR`: Read + FileInto
*   `FRS`: Read + FileInto + Stop
*   `FRA`: Read + FileInto + Archive
*   `FRAS`: Read + FileInto + Archive + Stop
*   `B`: Reject / Bounce
*   `Fx...`: Expire + FileInto (e.g. `Fx1`, `Fx12h`)

**From / Address Rules:**
*   `^sender@example.com^ F`: FileInto - Moves email.
*   `^sender@example.com^ FR`: Read + FileInto - Moves email and marks as Read.
*   `^sender@example.com^ FRS`: Read + FileInto + Stop - Moves, marks Read, and Stops.
*   `^sender@example.com^ FRA`: Read + FileInto + Archive - Continues processing.
*   `^sender@example.com^ FRAS`: Read + FileInto + Archive + Stop
*   `^sender@example.com^ Fx...`: Expire + FileInto
*   `^sender@example.com^ B`: Reject / Bounce

### 4. PATTERN (Required)
The text to match against the header.
- **Wildcards**: If the pattern contains `*` or `?`, the system automatically uses the Sieve `:matches` comparator.
- **Literal**: If no wildcards are present, the system uses the Sieve `:contains` comparator.

### 5. ALIAS MAPPING (Special)
Defines a list of aliased addresses that should target this rule folder using `X-Original-To`.

*   **Syntax**: `!alias1,alias2,...!CODE [PATTERN]`
*   **Example (no filter)**: `!auto,credit,receipts!FRAS` - Match any email to these mailboxes.
*   **Example (with filter)**: `!auto,credit!FR Order Confirmation` - Match emails to these mailboxes with subject containing "Order Confirmation".
    *   **Meaning**: If email is sent to `auto` OR `credit` OR `receipts`, apply the action. Optional PATTERN filters by subject.
    *   **Note**: When PATTERN is provided, alias rules also check the Subject header. Use `*` as a wildcard pattern to match any subject.

### 6. DESIGNATED LABELS (Preferred: `&label&`)
Use the `&...&` token to explicitly designate a label/folder for the rule to file into. This replaces the legacy `D`/`FRASD` conventions.

- **Syntax (preferred)**: Place `&labelName&` anywhere in the rule line. Example:

```
^senderExample@gmail.com^&labelName&FRASx1d Subject Line Here
```

- **Behavior**: The parser extracts the `&labelName&` token and the rule will `fileinto "labelName"` (and still honor flags like `F R A S` and expiry `x1d`).

> Use `&label&` in rule lines to designate a custom label. Legacy `FRASD`/`D` support has been removed.

## Examples

| Rule Line | Explanation |
| :--- | :--- |
| `F Your Order Shipped` | **Global Subject**. Moves to folder if subject contains text. |
| `FR Daily Digest` | **Global Subject**. Moves to folder, marks as **Read**. |
| `FRAS Security Alert` | **Global Subject**. Moves to folder, marks **Read**, copies to **Archive**, stops processing. |
| `B Buy Now` | **Global Subject**. **Rejects/Bounces** the email. |
| `^sender@example.com^ FR Subject` | **Global From**. Matches sender and subject. |
| `^info@example.com^ FRS` | **Global From**. Moves to folder if sender matches. Marks Read. Stops. |
| `!F Local Only` | **Scoped Subject**. Moves to folder ONLY if sent specifically to this mailbox. |
| `!^bad-actor@spam^ FRAS` | **Scoped From**. Read/Archive/Stop ONLY if sent to this mailbox. |
| `!B junk subject line` | **Scoped Subject**. **Rejects** if subject contains text, ONLY for this mailbox. |
| `Fx1 Temporary Code` | **Global Subject**. Moves to folder, sets **Expire in 1 day**. |
| `Fx4h One Time Pass` | **Global Subject**. Moves to folder, sets **Expire in 4 hours**. |
| `F *Verification*` | **Global Subject**. Uses `:matches` because of wildcards. |

## Invalid/Strict Mode
Any line that does not start with a valid action code (like `F`) is considered **Invalid** and will be skipped with a warning during the build process. You must be explicit.
