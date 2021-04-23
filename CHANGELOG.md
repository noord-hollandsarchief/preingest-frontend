# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Support for "pre-wash" custom XSLT transformations that run before validations and standard 
  transformations
- Lock settings that no longer affect the result once other actions have completed successfully,
  especially to prevent trying to ingest a given Preservica SIP file to multiple environments (which
  fails when environments are different tenants on the same cloud instance)


## 1.0.0 - 2021-04-01

Initial release, supporting firing validation and transformation from ToPX to Preservica XIPv4.

[Unreleased]: https://github.com/noord-hollandsarchief/preingest-frontend/compare/v1.0.0...HEAD
