// Run with trusted project credentials; never from the web app.
const { createRequire } = require('node:module');
const path = require('node:path');
const fr = createRequire(path.resolve(__dirname, '../functions/package.json'));
const { initializeApp, applicationDefault, deleteApp } = fr('firebase-admin/app');
const { getAuth } = fr('firebase-admin/auth');
const [projectId, uid, action] = process.argv.slice(2);
if (!projectId || !uid || !['grant', 'revoke'].includes(action)) {
  console.error('Usage: node scripts/site-admin.cjs PROJECT_ID AUTH_UID grant|revoke');
  process.exit(1);
}
const app = initializeApp({ projectId, credential: applicationDefault() });
(async () => {
  const auth = getAuth(app);
  const user = await auth.getUser(uid);
  const claims = { ...user.customClaims };
  if (action === 'grant') claims.siteAdmin = true;
  else delete claims.siteAdmin;
  await auth.setCustomUserClaims(uid, claims);
  console.log(`Site administration ${action === 'grant' ? 'granted to' : 'revoked for'} ${uid} in ${projectId}. Sign in again to update navigation.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => deleteApp(app));
