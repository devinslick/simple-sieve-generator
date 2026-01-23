# Template: v3
# {{RULE_NAME}}

require ["include", "environment", "variables", "relational", "comparator-i;ascii-numeric", "spamtest", "fileinto", "imap4flags", "vnd.proton.expire", "extlists"];

# Generated: Do not run this script on spam messages
if allof (environment :matches "vnd.proton.spam-threshold" "*", spamtest :value "ge" :comparator "i;ascii-numeric" "${1}") {
    return;
}

# Guardian: Do not run if addressed to excluded mailboxes (e.g. new@, personal@)
if allof (not header :comparator "i;unicode-casemap" :contains "X-Original-To" [{{LIST:excluded-mailboxes:contains}}], header :contains "Delivered-To" ["@"])
{

# --- GLOBAL RULES ---

# 1. F | Fileinto (Subject)
if anyof (
  header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:global-subject-default:contains}}],
  header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:global-subject-default:matches}}]
) {
  fileinto "{{RULE_NAME}}";
}

# 2. FR | Fileinto + Read (Subject)
if anyof (
  header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:global-subject-read:contains}}],
  header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:global-subject-read:matches}}]
) {
  fileinto "{{RULE_NAME}}";
  addflag "\\Seen";
}

# 3. FRS | Fileinto + Read + Stop (Subject)
if anyof (
  header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:global-subject-read-stop:contains}}],
  header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:global-subject-read-stop:matches}}]
) {
  fileinto "{{RULE_NAME}}";
  addflag "\\Seen";
  stop;
}

# 4. FRA | Fileinto + Read + Archive (Subject)
if anyof (
  header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:global-subject-read-archive:contains}}],
  header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:global-subject-read-archive:matches}}]
) {
  fileinto "{{RULE_NAME}}";
  addflag "\\Seen";
  fileinto "archive";
}

# 5. FRAS | Fileinto + Read + Archive + Stop (Subject)
if anyof (
  header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:global-subject-read-archive-stop:contains}}],
  header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:global-subject-read-archive-stop:matches}}]
) {
  fileinto "{{RULE_NAME}}";
  addflag "\\Seen";
  fileinto "archive";
  stop;
}

# 6. from:FRS | Fileinto + Read + Stop (From)
if anyof (
  address :all :comparator "i;unicode-casemap" :contains ["From"] [{{LIST:global-from-read-stop:contains}}],
  address :all :comparator "i;unicode-casemap" :matches ["From"] [{{LIST:global-from-read-stop:matches}}]
) {
  fileinto "{{RULE_NAME}}";
  addflag "\\Seen";
  stop;
}

# 7. from:FRAS | Fileinto + Read + Archive + Stop (From)
if anyof (
  address :all :comparator "i;unicode-casemap" :contains ["From"] [{{LIST:global-from-read-archive-stop:contains}}],
  address :all :comparator "i;unicode-casemap" :matches ["From"] [{{LIST:global-from-read-archive-stop:matches}}]
) {
  fileinto "{{RULE_NAME}}";
  addflag "\\Seen";
  fileinto "archive";
  stop;
}

# 8. Fx1 | Fileinto + Expire 1 Day (Subject)
if anyof (
  header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:global-subject-expire:contains}}],
  header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:global-subject-expire:matches}}]
) {
  fileinto "{{RULE_NAME}}";
  expire "day" "1";
  stop;
}

# --- SCOPED RULES (Applies only to mailbox: {{RULE_NAME}}) ---
if header :contains "X-Original-To" "{{RULE_NAME_LOWER}}" {

    # 9. Scoped F | Fileinto (Subject)
    if anyof (
      header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:scoped-subject-default:contains}}],
      header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:scoped-subject-default:matches}}]
    ) {
      fileinto "{{RULE_NAME}}";
    }

    # 10. Scoped FR | Fileinto + Read (Subject)
    if anyof (
      header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:scoped-subject-read:contains}}],
      header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:scoped-subject-read:matches}}]
    ) {
      fileinto "{{RULE_NAME}}";
      addflag "\\Seen";
    }

    # 11. Scoped FRS | Fileinto + Read + Stop (Subject)
    if anyof (
      header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:scoped-subject-read-stop:contains}}],
      header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:scoped-subject-read-stop:matches}}]
    ) {
      fileinto "{{RULE_NAME}}";
      addflag "\\Seen";
      stop;
    }

    # 12. Scoped FRA | Fileinto + Read + Archive (Subject)
    if anyof (
      header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:scoped-subject-read-archive:contains}}],
      header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:scoped-subject-read-archive:matches}}]
    ) {
      fileinto "{{RULE_NAME}}";
      addflag "\\Seen";
      fileinto "archive";
    }

    # 13. Scoped FRAS | Fileinto + Read + Archive + Stop (Subject)
    if anyof (
      header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:scoped-subject-read-archive-stop:contains}}],
      header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:scoped-subject-read-archive-stop:matches}}]
    ) {
      fileinto "{{RULE_NAME}}";
      addflag "\\Seen";
      fileinto "archive";
      stop;
    }

    # 14. Scoped from:FRS | Fileinto + Read + Stop (From)
    if anyof (
      address :all :comparator "i;unicode-casemap" :contains ["From"] [{{LIST:scoped-from-read-stop:contains}}],
      address :all :comparator "i;unicode-casemap" :matches ["From"] [{{LIST:scoped-from-read-stop:matches}}]
    ) {
      fileinto "{{RULE_NAME}}";
      addflag "\\Seen";
      stop;
    }

    # 15. Scoped from:FRAS | Fileinto + Read + Archive + Stop (From)
    if anyof (
      address :all :comparator "i;unicode-casemap" :contains ["From"] [{{LIST:scoped-from-read-archive-stop:contains}}],
      address :all :comparator "i;unicode-casemap" :matches ["From"] [{{LIST:scoped-from-read-archive-stop:matches}}]
    ) {
      fileinto "{{RULE_NAME}}";
      addflag "\\Seen";
      fileinto "archive";
      stop;
    }

    # 16. Scoped Fx1 | Fileinto + Expire 1 Day (Subject)
    if anyof (
      header :comparator "i;unicode-casemap" :contains "Subject" [{{LIST:scoped-subject-expire:contains}}],
      header :comparator "i;unicode-casemap" :matches "Subject" [{{LIST:scoped-subject-expire:matches}}]
    ) {
      fileinto "{{RULE_NAME}}";
      expire "day" "1";
      stop;
    }
}

}
