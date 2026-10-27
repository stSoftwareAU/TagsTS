// Entry point for `deno test` default discovery (*_test.ts). The guard tests
// live in test/ActionPins.ts and test/ActionPinsScan.ts, whose names the
// default discovery does not match, so a mutation of a line in them would
// otherwise reach no test. Importing ActionPinsScan.ts registers the tests of
// both modules.
import "./ActionPinsScan.ts";
