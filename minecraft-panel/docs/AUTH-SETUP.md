# Sign-in, registration and Google (Gmail) accounts

The panel ships four ways to get in:

| Flow | Route | Who can use it |
|---|---|---|
| Email + password | `/login` | everyone |
| Self-registration | `/register` | when *Allow self-registration* is on (default **on**) |
| Password reset by email | `/forgot` → `/reset?token=…` | everyone with an account |
| Continue with Google | `/auth/google/start` | when OAuth credentials are saved |

Admins manage all of this in **Settings → Sign-in & email**. Nothing needs to be
edited by hand, and secrets are stored in the panel database (never sent to the
browser).

## Roles and what self-service accounts get

* Self-registered and Google-created accounts are always **members**.
  Only an administrator can create another administrator (Users page or CLI).
* Members see and control only the servers they own.
* Turn registration off at any time; existing accounts keep working and an admin
  can still create users manually.

## Password reset email

1. Open **Settings → Sign-in & email → Password reset email**.
2. Pick a transport:

   | Transport | When to use |
   |---|---|
   | `PHP mail()` / sendmail | BT Panel already has a mail server or `sendmail` is installed |
   | SMTP | Recommended: Gmail, SES, Mailgun, your provider |
   | Log to file | No mail yet; links land in `storage/logs/mail.log` |

3. SMTP example with a **Gmail app password** (Google Workspace or personal):

   | Field | Value |
   |---|---|
   | Host | `smtp.gmail.com` |
   | Port | `587` (STARTTLS) or `465` (SSL) |
   | Encryption | `STARTTLS` / `SSL` accordingly |
   | Username | `you@gmail.com` |
   | Password | 16-character **app password** (not your Google password) |
   | From | same Gmail address |

   App passwords require 2-Step Verification:
   <https://myaccount.google.com/apppasswords>. Google rewrites the `From`
   header to the authenticated account, so use that address as *From*.

4. Press **Send test email** and check the inbox/spam.

Reset links are single-use, expire after 60 minutes, and invalidate every other
session for that account. The “email sent” response is identical for unknown
addresses, so the form cannot be used to discover who has an account.

### No mail server? Two admin escape hatches

```bash
sudo -u www php bin/btp user:passwd user@example.com        # set a password directly
sudo -u www php bin/btp user:reset-link user@example.com    # print a one-time URL to send manually
```

## Google / Gmail sign-in

### 1. Create the OAuth client

1. Open <https://console.cloud.google.com/apis/credentials> and pick (or create) a project.
2. **Configure consent screen** (now “Google Auth Platform → Branding”):
   - User type **External**, fill app name + support email.
   - Publishing status **Testing** works for up to 100 test users and needs no
     verification; add your own Google account under *Test users*.
   - Scopes: the panel only requests `openid email profile` (non-sensitive).
3. **Create credentials → OAuth client ID → Web application**.
4. **Authorized redirect URIs** — add this exact value (also shown in the panel):

   ```
   https://mc.example.com/auth/google/callback
   ```

   Use HTTPS in production. `http://localhost:8080/auth/google/callback` is fine
   for local testing. Trailing-slash or `www` differences count as a different URI.

### 2. Paste it into the panel

**Settings → Sign-in & email → Google / Gmail sign-in**

| Field | Where it comes from |
|---|---|
| Client ID | ends with `.apps.googleusercontent.com` |
| Client secret | “Client secret” in the same dialog (stored server-side) |
| Authorized redirect URI | must match Google exactly |
| Allowed email domains | optional, e.g. `gmail.com` or `yourcompany.com` |
| Show “Continue with Google” | enable/disable the button |

The panel shows the redirect URI to copy, and marks the badge
**Google enabled / configured, off / not configured**.

### 3. How accounts are matched

1. Known `google_id` → signed in.
2. No `google_id`, but the email already exists in the panel → the Google
   identity is **linked** to that account (Google has verified the address).
3. New email → a **member** account is created, but only while
   self-registration is enabled; otherwise sign-in is refused with a clear
   message.

Unverified Google emails are rejected. CSRF-style `state` is generated per login,
kept in the PHP session and expires after 10 minutes.

## Security notes

* Passwords: `password_hash()` (bcrypt), minimum 10 characters.
* Sessions: opaque 256-bit tokens, stored as SHA-256 hashes, `HttpOnly`,
  `SameSite=Lax`, `Secure` when `secure_cookies` is on.
* “Keep me signed in” controls whether the cookie survives a browser restart;
  the server-side token expires after 14 days either way.
* Rate limits (per IP / email, 15-minute windows): registration 5, Google
  signups 5, password reset requests 5, reset submissions 10, logins 8.
* Google-created accounts get a random unusable password, so they must use
  “Forgot password?” (or an admin) to add a password before email sign-in works.
* Set `'secure_cookies' => true` in `config.php` once HTTPS is enabled.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `redirect_uri_mismatch` from Google | The URI in Google Cloud Console differs from **Authorized redirect URI**. Copy it from the panel. |
| Button missing | Credentials not saved, or the “Show Continue with Google” switch is off. |
| `Google sign-in is not configured` (503) | Client ID/secret are empty. |
| No reset email arrives, transport `mail` | No local MTA. Switch to SMTP and use **Send test email**; check spam. |
| Reset link says expired | Links live 60 minutes and are single-use. Request a new one. |
| Registration page says disabled | **Settings → Allow self-registration**, or create the user from the Users page. |
| “Sign-in is limited to these domains” | An email-domain allowlist is set; adjust it or sign in with an allowed domain. |
