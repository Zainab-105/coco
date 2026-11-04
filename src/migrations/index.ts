import * as migration_20261102_055530_initial from './20261102_055530_initial';
import * as migration_20261102_064506_effective_price from './20261102_064506_effective_price';
import * as migration_20261102_071905_checkout_fields from './20261102_071905_checkout_fields';
import * as migration_20261102_074253_admin_ops from './20261102_074253_admin_ops';
import * as migration_20261102_081029_marketing_reports from './20261102_081029_marketing_reports';
import * as migration_20261104_073040_reviews_support_accounts from './20261104_073040_reviews_support_accounts';
import * as migration_20261104_110410_security_seo from './20261104_110410_security_seo';

export const migrations = [
  {
    up: migration_20261102_055530_initial.up,
    down: migration_20261102_055530_initial.down,
    name: '20261102_055530_initial',
  },
  {
    up: migration_20261102_064506_effective_price.up,
    down: migration_20261102_064506_effective_price.down,
    name: '20261102_064506_effective_price',
  },
  {
    up: migration_20261102_071905_checkout_fields.up,
    down: migration_20261102_071905_checkout_fields.down,
    name: '20261102_071905_checkout_fields',
  },
  {
    up: migration_20261102_074253_admin_ops.up,
    down: migration_20261102_074253_admin_ops.down,
    name: '20261102_074253_admin_ops',
  },
  {
    up: migration_20261102_081029_marketing_reports.up,
    down: migration_20261102_081029_marketing_reports.down,
    name: '20261102_081029_marketing_reports',
  },
  {
    up: migration_20261104_073040_reviews_support_accounts.up,
    down: migration_20261104_073040_reviews_support_accounts.down,
    name: '20261104_073040_reviews_support_accounts',
  },
  {
    up: migration_20261104_110410_security_seo.up,
    down: migration_20261104_110410_security_seo.down,
    name: '20261104_110410_security_seo'
  },
];
