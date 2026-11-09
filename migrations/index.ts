import * as migration_20261031_200002_payload_journal from './20261031_200002_payload_journal';
import * as migration_20261031_202034_history_precision from './20261031_202034_history_precision';
import * as migration_20261102_200000_native_journal from './20261102_200000_native_journal';
import * as migration_20261104_110000_portfolio_categories from './20261104_110000_portfolio_categories';
import * as migration_20261104_120000_site_expansion from './20261104_120000_site_expansion';
import * as migration_20261105_120000_homepage from './20261105_120000_homepage';
import * as migration_20261106_120000_large_originals from './20261106_120000_large_originals';
import * as migration_20261109_120000_page_customization from './20261109_120000_page_customization';

export const migrations = [
  {
    up: migration_20261031_200002_payload_journal.up,
    down: migration_20261031_200002_payload_journal.down,
    name: '20261031_200002_payload_journal',
  },
  {
    up: migration_20261031_202034_history_precision.up,
    down: migration_20261031_202034_history_precision.down,
    name: '20261031_202034_history_precision'
  },
  {
    up: migration_20261102_200000_native_journal.up,
    down: migration_20261102_200000_native_journal.down,
    name: '20261102_200000_native_journal',
  },
  {
    up: migration_20261104_110000_portfolio_categories.up,
    down: migration_20261104_110000_portfolio_categories.down,
    name: '20261104_110000_portfolio_categories',
  },
  {
    up: migration_20261104_120000_site_expansion.up,
    down: migration_20261104_120000_site_expansion.down,
    name: '20261104_120000_site_expansion',
  },
  {
    up: migration_20261105_120000_homepage.up,
    down: migration_20261105_120000_homepage.down,
    name: '20261105_120000_homepage',
  },
  {
    up: migration_20261106_120000_large_originals.up,
    down: migration_20261106_120000_large_originals.down,
    name: '20261106_120000_large_originals',
  },
  {
    up: migration_20261109_120000_page_customization.up,
    down: migration_20261109_120000_page_customization.down,
    name: '20261109_120000_page_customization',
  },
];
