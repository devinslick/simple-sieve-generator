
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
- **`^sender@example.com^`**: (Preferred) Check the **From** header using an inline token. Place the `^...^` token anywhere in the rule line; remaining text is treated as the Subject filter. Example: `^sender@example.com^ FR Subject Text`.

> Deprecated: the older `from:` prefix is supported for backward compatibility but will be removed in a future release. Prefer the `^...^` syntax.

### 3. ACTION (Required)
A combination of characters that determine what happens when the pattern matches.

| Code | Meaning | Logic Applied |
| :--- | :--- | :--- |
| `F` | **FileInto** | Moves email to the folder. (Default behavior) |
| `R` | **Read** | Marks the email as seen (`\Seen`). |
| `A` | **Archive** | Moves email to the `Archive` folder (and the Rule folder). |
| `S` | **Stop** | Stops processing further Sieve scripts. |
| `D` | **Designated (deprecated)** | Legacy: moved email to a specific destination. Use `&label&` instead. |
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

**From Rules:**
*   `from:F`: FileInto - *Moves email.*
*   `from:FR`: Read + FileInto - *Moves email and marks as Read.*
*   `from:FRS`: Read + FileInto + Stop - *Moves, marks Read, and Stops.*
*   `from:FRA`: Read + FileInto + Archive - *Continues processing.*
*   `from:FRAS`: Read + FileInto + Archive + Stop
*   `from:Fx...`: Expire + FileInto
*   `from:B`: Reject / Bounce)

### 4. PATTERN (Required)
The text to match against the header.
- **Wildcards**: If the pattern contains `*` or `?`, the system automatically uses the Sieve `:matches` comparator.
- **Literal**: If no wildcards are present, the system uses the Sieve `:contains` comparator.

### 5. ALIAS MAPPING (Special)
Defines a list of aliased addresses that should target this rule folder using `X-Original-To`.

*   **Syntax**: `!alias1,alias2,...!CODE [PATTERN]`
*   **Example**: `!auto,credit,receipts!FRAS *`
    *   **Meaning**: If email is sent to `auto` OR `credit` OR `receipts`, apply action `FRAS`.
    *   **Note**: The **PATTERN** is currently ignored for Alias rules. These rules are designed for **Mailbox Routing**.

### 6. DESIGNATED LABELS (Preferred: `&label&`)
Use the `&...&` token to explicitly designate a label/folder for the rule to file into. This replaces the legacy `D`/`FRASD` conventions.

- **Syntax (preferred)**: Place `&labelName&` anywhere in the rule line. Example:

```
^senderExample@gmail.com^&labelName&FRASx1d Subject Line Here
```

- **Behavior**: The parser extracts the `&labelName&` token and the rule will `fileinto "labelName"` (and still honor flags like `F R A S` and expiry `x1d`).

> Deprecated: `FRASD label` and the `D` flag are supported for backward compatibility but will be removed in a future release. Prefer `&label&`.

## Examples

| Rule Line | Explanation |
| :--- | :--- |
| `F Your Order Shipped` | **Global Subject**. Moves to folder if subject contains text. Stops. |
| `FR Daily Digest` | **Global Subject**. Moves to folder, marks as **Read**. Stops. |
| `FRAS Security Alert` | **Global Subject**. Moves to folder, marks **Read**, copies to **Archive**. Stops. |
| `B Buy Now` | **Global Subject**. **Rejects/Bounces** the email. |
| `^sender@example.com^ FR Subject` | **Global From (preferred)**. Matches sender and subject. |
| `from:FRS info@example.com` | **Global From (deprecated)**. Moves to folder if sender matches. Marks Read. Stops. |
| `!F Local Only` | **Scoped Subject**. Moves to folder ONLY if sent specifically to this mailbox. |
| `!from:FRAS bad-actor@spam` | **Scoped From**. Read/Archive/Stop ONLY if sent to this mailbox. |
| `!B malicious-user` | **Scoped Subject**. **Rejects** if subject contains text, ONLY for this mailbox. |
| `Fx1 Temporary Code` | **Global Subject**. Moves to folder, sets **Expire in 1 day**. |
| `Fx4h One Time Pass` | **Global Subject**. Moves to folder, sets **Expire in 4 hours**. |
| `F *Verification*` | **Global Subject**. Uses `:matches` because of wildcards. |

## Invalid/Strict Mode
Any line that does not start with a valid action code (like `F`) is considered **Invalid** and will be skipped with a warning during the build process. You must be explicit.
