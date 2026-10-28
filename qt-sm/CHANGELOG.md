# Change Log

## Unreleased

🎉 **Added**

- Sign in to the Qt Account in the browser with OpenID Connect (authorization code flow with PKCE)
- Sign in with a personal access token for windowless use
- Show the browser sign-in progress in the walkthrough (waiting, stalled, failed, signed in with privacy opt-ins)
- Pick up logins and logouts made by other Qt tools from the shared Qt.ini
- Start the elevated helper when the Qt Software Management Service needs administrator rights

⚠️ **Changed**

- Store the Qt Account credentials in the shared Qt.ini that the Qt Software Management Service reads and renews
- Update the walkthrough to the "Install Qt" design
- Follow the updated service protocol: identify the extension with every request, show package display names, and keep quiet when the user declines a license agreement

🗑️ **Removed**

- Remove the email and password login and the `@qt.io` alpha allow list, the login server controls access now

## 0.1.4 (Aug 4, 2026)

🎉 **Added**

- Allow the `theqtcompany.com` domain to access the alpha version
- Add a "Reset password" button to the walkthrough sign-in step

⚠️ **Changed**

- Prefill the login email prompt with the last attempted address on retry
- Show a readable message with a "Reset Password" action for invalid credentials
- Hide "Reset walkthrough" when there is no progress and "Mark Done" once done

## 0.1.3 (Jun 25, 2026)

🎉 **Added**

- Show the themed Qt icon on the Get Started walkthrough tab

⚠️ **Changed**

- Restrict alpha access to `@qt.io` Qt Account emails
- Include the installed version in the install success message

🐞 **Fixed**

- Fix the walkthrough growing unbounded instead of scrolling
- Enable "Get latest Qt Framework" when the latest version is not installed

## 0.1.2 (Jun 24, 2026)

🎉 **Added**

- Add a custom walkthrough

⚠️ **Changed**

- Rename the extension from `qt-sms` to `qt-sm`
- Rename commands to use the `SM` prefix instead of `SMS`

🐞 **Fixed**

- Refresh the walkthrough when the installation root is removed

## 0.1.1 (Jun 5, 2026)

🐞 **Fixed**

- Install Qt extensions as pre-release in walkthrough to avoid inconsistency

## 0.1.0 (Jun 5, 2026)

🎉 **Added**

- Initial release
- Search available Qt packages
- List installed Qt packages
- Install Qt packages
- Walkthrough
