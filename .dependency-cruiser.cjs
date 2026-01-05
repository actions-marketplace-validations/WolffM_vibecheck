/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are not allowed',
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Orphan modules (not imported anywhere) should be removed',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)vitest\\.config\\.ts$',
          '\\.test\\.ts$',
          'test-fixtures/'
        ]
      },
      to: {}
    },
    {
      name: 'no-deprecated-core',
      severity: 'warn',
      comment: 'Avoid using deprecated Node.js core modules',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: [
          '^punycode$',
          '^domain$',
          '^constants$',
          '^sys$',
          '^_stream'
        ]
      }
    },
    {
      name: 'not-to-test',
      severity: 'error',
      comment: 'Production code should not import test files',
      from: {
        pathNot: '\\.test\\.ts$'
      },
      to: {
        path: '\\.test\\.ts$'
      }
    },
    {
      name: 'not-to-spec',
      severity: 'error',
      comment: 'Production code should not import spec files',
      from: {
        pathNot: '\\.spec\\.ts$'
      },
      to: {
        path: '\\.spec\\.ts$'
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json'
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default']
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+'
      }
    }
  }
};
