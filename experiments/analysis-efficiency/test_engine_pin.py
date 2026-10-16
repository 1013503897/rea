import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location('agent_trial', Path(__file__).with_name('agent-trial.py'))
trial = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trial)


class ExperimentalEnginePinTests(unittest.TestCase):
    def test_missing_pin_preserves_other_provider_trials(self):
        self.assertIsNone(trial.pinned_experimental_engine({}))
        self.assertIsNone(trial.experimental_engine_unchanged(None))

    def test_feature_build_replacement_and_removal_invalidate_pinned_engine(self):
        with tempfile.TemporaryDirectory() as directory:
            engine = Path(directory) / 'kuna'
            engine.write_bytes(b'embedded-spec-build')
            engine.chmod(0o755)
            settings = {'REA_KUNA_COMMAND': str(engine),
                        'REA_ATOMIC_NATIVE_IR_ENGINE_SHA256': hashlib.sha256(engine.read_bytes()).hexdigest()}
            receipt = trial.pinned_experimental_engine(settings)
            self.assertTrue(trial.experimental_engine_unchanged(receipt))
            engine.write_bytes(b'non-embedded-test-build')
            with self.assertRaisesRegex(ValueError, 'differs from its pin'):
                trial.pinned_experimental_engine(settings)
            self.assertFalse(trial.experimental_engine_unchanged(receipt))
            engine.unlink()
            self.assertFalse(trial.experimental_engine_unchanged(receipt))
            with self.assertRaisesRegex(ValueError, 'absolute executable'):
                trial.pinned_experimental_engine(settings)

    def test_malformed_pin_and_relative_command_are_rejected(self):
        for settings in [
            {'REA_ATOMIC_NATIVE_IR_ENGINE_SHA256': 'bad'},
            {'REA_ATOMIC_NATIVE_IR_ENGINE_SHA256': '0' * 64, 'REA_KUNA_COMMAND': './kuna'},
        ]:
            with self.assertRaises(ValueError):
                trial.pinned_experimental_engine(settings)


if __name__ == '__main__':
    unittest.main()
