import * as migration_20261031_200002_payload_journal from './20261031_200002_payload_journal';
import * as migration_20261031_202034_history_precision from './20261031_202034_history_precision';

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
];
