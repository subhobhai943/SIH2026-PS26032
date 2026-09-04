import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import Staff from '../models/Staff.js';

async function seedAdminSub() {
  await connectDB(env.mongoUri);

  const username = 'SUB';
  const email = 'sub@sih26032.local';
  const password = 'SUB';
  const passwordHash = await Staff.hashPassword(password);

  let staff = await Staff.findOne({
    $or: [{ username: 'SUB' }, { email }],
  });

  if (!staff) {
    staff = await Staff.create({
      username,
      email,
      name: 'System Administrator (SUB)',
      passwordHash,
      role: 'admin',
      isActive: true,
    });
    console.log(`[seedAdminSub] Created new admin user: ${username} / ${password}`);
  } else {
    staff.username = username;
    staff.email = email;
    staff.name = 'System Administrator (SUB)';
    staff.passwordHash = passwordHash;
    staff.role = 'admin';
    staff.isActive = true;
    await staff.save();
    console.log(`[seedAdminSub] Updated existing admin user: ${username} / ${password}`);
  }

  await disconnectDB();
  console.log('[seedAdminSub] Complete!');
}

seedAdminSub().catch((err) => {
  console.error('[seedAdminSub] Error:', err);
  process.exit(1);
});
