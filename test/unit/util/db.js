const appRoot = require('app-root-path');
const should = require('should');
const { sql } = require('slonik');
const { Frame, table, into } = require(appRoot + '/lib/model/frame');
const util = require(appRoot + '/lib/util/db');
const Option = require(appRoot + '/lib/util/option');
const Problem = require(appRoot + '/lib/util/problem');

describe('util/db', () => {
  describe('connectionString', () => {
    const { connectionString } = util;

    it('should return a string with the required options', () => {
      const result = connectionString({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz'
      });
      result.should.equal('postgres://bar:baz@localhost/foo');
    });

    it('should encode the password', () => {
      const result = connectionString({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'b@z'
      });
      result.should.equal('postgres://bar:b%40z@localhost/foo');
    });

    it('should use the port if one is specified', () => {
      const result = connectionString({
        host: 'localhost',
        port: 1234,
        database: 'foo',
        user: 'bar',
        password: 'baz'
      });
      result.should.equal('postgres://bar:baz@localhost:1234/foo');
    });

    it('should return ?ssl=true if ssl is true', () => {
      const result = connectionString({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz',
        ssl: true
      });
      result.should.equal('postgres://bar:baz@localhost/foo?ssl=true');
    });

    it('should throw if ssl is false', () => {
      const result = () => connectionString({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz',
        ssl: false
      });
      result.should.throw();
    });

    it('should throw if ssl is an object', () => {
      const result = () => connectionString({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz',
        ssl: { rejectUnauthorized: false }
      });
      result.should.throw();
    });

    it('should throw for an unsupported option', () => {
      const result = () => connectionString({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz',
        encoding: 'latin1'
      });
      result.should.throw();
    });
  });

  describe('connectionObject', () => {
    const { connectionObject } = util;

    it('should return an object with the required options', () => {
      const result = connectionObject({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz'
      });
      result.should.eql({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz'
      });
    });

    it('should include the port if one is specified', () => {
      const result = connectionObject({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz',
        port: 1234
      });
      result.should.eql({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz',
        port: 1234
      });
    });

    it('should return the correct object if ssl is true', () => {
      const result = connectionObject({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz',
        ssl: true
      });
      result.should.eql({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz',
        ssl: { rejectUnauthorized: false }
      });
    });

    it('should throw if ssl is false', () => {
      const result = () => connectionObject({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz',
        ssl: false
      });
      result.should.throw();
    });

    it('should throw if ssl is an object', () => {
      const result = () => connectionObject({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz',
        ssl: { rejectUnauthorized: false }
      });
      result.should.throw();
    });

    it('should throw for an unsupported option', () => {
      const result = () => connectionObject({
        host: 'localhost',
        database: 'foo',
        user: 'bar',
        password: 'baz',
        encoding: 'latin1'
      });
      result.should.throw();
    });
  });

  describe('unjoiner', () => {
    const { unjoiner } = util;
    const T = Frame.define(table('frames'), 'x',  'y');
    const U = Frame.define(into('extra'), 'z');
    it('should generate fields', () => {
      unjoiner(T, U)
        .fields.should.eql(sql`frames."x" as "frames!x",frames."y" as "frames!y","z" as "z"`);
    });

    it('should unjoin data', () => {
      unjoiner(T, U)
        ({ 'frames!x': 3, 'frames!y': 4, z: 5 })
        .should.eql(new T({ x: 3, y: 4 }, { extra: new U({ z: 5 }) }));
    });

    it('should optionally unjoin optional data', () => {
      const unjoin = unjoiner(T, Option.of(U));
      unjoin.fields.should.eql(sql`frames."x" as "frames!x",frames."y" as "frames!y","z" as "z"`);
      unjoin({ 'frames!x': 3, 'frames!y': 4, z: 5 })
        .should.eql(new T({ x: 3, y: 4 }, { extra: Option.of(new U({ z: 5 })) }));
      unjoin({ 'frames!x': 3, 'frames!y': 4 })
        .should.eql(new T({ x: 3, y: 4 }, { extra: Option.none() }));
    });
  });

  describe('extender', () => {
    const { extender, QueryOptions } = util;
    const T = Frame.define(table('frames'), 'x',  'y');
    const U = Frame.define(into('extra'), 'a', 'b');
    function noop() { return Promise.resolve({}); };
    noop.map = (f) => (x) => x;

    it('should provide the appropriate arguments when not extended', () => {
      let run = false;
      extender(T)(U)((fields, extend, options, x, y, z) => {
        fields.should.eql(sql`frames."x" as "frames!x",frames."y" as "frames!y"`);
        (sql`${extend|| true}`).should.eql(sql``);
        x.should.equal(2);
        y.should.equal(3);
        z.should.equal(4);
        run = true;
      })(noop, QueryOptions.none, 2, 3, 4);
      run.should.equal(true);
    });

    it('should provide the appropriate arguments when extended', () => {
      let run = false;
      extender(T)(U)((fields, extend, options, x, y, z) => {
        fields.should.eql(sql`frames."x" as "frames!x",frames."y" as "frames!y","a" as "a","b" as "b"`);
        (sql`${extend|| true}`).should.eql(sql`${true}`);
        x.should.equal(2);
        y.should.equal(3);
        z.should.equal(4);
        run = true;
      })(noop, QueryOptions.extended, 2, 3, 4);
      run.should.equal(true);
    });

    it('should unjoin nonextended fields', () => {
      function run() { return Promise.resolve({ 'frames!x': 3, 'frames!y': 4 }); };
      run.map = (f) => (x) => f(x);
      return extender(T)(U)(noop)(run, QueryOptions.none)
        .then((result) => result.should.eql(new T({ x: 3, y: 4 })));
    });

    it('should unjoin extended fields', () => {
      function run() { return Promise.resolve({ 'frames!x': 3, 'frames!y': 4, a: 5 }); };
      run.map = (f) => (x) => f(x);
      return extender(T)(U)(noop)(run, QueryOptions.extended)
        .then((result) => result.should.eql(new T({ x: 3, y: 4 }, { extra: new U({ a: 5 }) })));
    });
  });

  describe('insert', () => {
    const { insert } = util;
    const T = Frame.define(table('frames'));

    it('should formulate a basic response based on data', () => {
      insert(new T({ x: 2, y: 3 })).should.eql(sql`
insert into frames ("x","y")
values (${2},${3})
returning *`);
    });

    it('should deal with strange data input types', () => {
      insert(new T({ x: { test: true }, y: undefined, z: new Date('2000-01-01') }))
        .should.eql(sql`
insert into frames ("x","y","z")
values (${'{"test":true}'},${null},${'2000-01-01T00:00:00.000Z'})
returning *`);
    });

    it('should automatically insert into createdAt if expected', () => {
      const U = Frame.define(table('cats'), 'createdAt', 'updatedAt');
      insert(new U()).should.eql(sql`
insert into cats ("createdAt")
values (${sql`clock_timestamp()`})
returning *`);
    });
  });

  describe('insertMany', () => {
    const { insertMany } = util;
    const T = Frame.define(table('dogs'), 'x', 'y');

    it('should do nothing if given no data', () => {
      insertMany([]).should.eql(sql`select true`);
    });

    it('should insert all data', () => {
      insertMany([ new T({ x: 2 }), new T({ y: 3 }) ]).should.eql(sql`
insert into dogs ("x","y")
values (${2},${null}),(${null},${3})`);
    });

    it('should insert createdAt and strange values', () => {
      const U = Frame.define(table('dogs'), 'x', 'createdAt');
      insertMany([ new U({ x: new Date('2000-01-01') }), new U() ]).should.eql(sql`
insert into dogs ("x","createdAt")
values (${'2000-01-01T00:00:00.000Z'},${sql`clock_timestamp()`}),(${null},${sql`clock_timestamp()`})`);
    });
  });

  describe('updater', () => {
    const { updater } = util;
    const T = Frame.define(table('rabbits'));

    it('should update the given data', () => {
      updater(new T({ id: 1, x: 2 }), new T({ y: 3 })).should.eql(sql`
update rabbits
set "y"=${3}

where ${sql.identifier([ 'id' ])}=${1}
returning *`);
    });

    it('should set updatedAt if present', () => {
      const U = Frame.define(table('rabbits'), 'createdAt', 'updatedAt');
      updater(new U({ id: 1, x: 2 }), new U({ y: 3 })).should.eql(sql`
update rabbits
set "y"=${3}
,"updatedAt"=clock_timestamp()
where "id"=${1}
returning *`);
    });

    it('should use a different id key if given', () => {
      updater(new T({ otherId: 0, x: 2 }), new T({ y: 3 }), 'otherId').should.eql(sql`
update rabbits
set "y"=${3}

where "otherId"=${0}
returning *`);
    });
  });

  describe('equals', () => {
    const { equals } = util;
    it('should do nothing if given no conditions', () => {
      equals({}).should.eql(sql`true`);
    });

    it('should match k/v pairs', () => {
      equals({ x: 2, y: 3 })
        .should.eql(sql.join([ sql`"x"=${2}`, sql`"y"=${3}` ], sql` and `));
    });

    it('should split compound keys', () => {
      equals({ 'x.y': 2 })
        .should.eql(sql.join([ sql`"x"."y"=${2}` ], sql` and `));
    });
  });

  describe('QueryOptions', () => {
    const { QueryOptions } = util;
    it('should cascade conditions properly', () => {
      const query = QueryOptions.extended.withCondition({ a: 1 }).withCondition({ b: 2 });
      query.condition.should.eql({ a: 1, b: 2 });
      query.extended.should.equal(true);
    });

    it('should correctly determine if paging exists', () => {
      (new QueryOptions()).hasPaging().should.equal(false);
      (new QueryOptions({ offset: 0 })).hasPaging().should.equal(true);
      (new QueryOptions({ limit: 0 })).hasPaging().should.equal(true);
    });

    it('should transfer allowed args from quarantine on allowArgs', () => {
      (new QueryOptions({ argData: { a: 1, b: 2, c: 3, d: 4 } }))
        .allowArgs('b', 'c', 'e')
        .args.should.eql({ b: 2, c: 3 });
    });

    it('should merge with existing args on allowArgs', () => {
      (new QueryOptions({ args: { b: 4, f: 9 }, argData: { a: 1, b: 2, c: 3, d: 4 } }))
        .allowArgs('b', 'c', 'e')
        .args.should.eql({ b: 2, c: 3, f: 9 });
    });

    describe('related functions', () => {
      it('should run the handler only if the arg is present', () => {
        let ran = false;
        const options = new QueryOptions({ args: { b: 42 }, argData: { c: 17 } });
        options.ifArg('c', () => { ran = true; });
        ran.should.equal(false);
        options.ifArg('b', () => { ran = true; });
        ran.should.equal(true);
      });

      it('should provide the correct arguments to the handler', () => {
        let ran = false;
        const options = new QueryOptions({ args: { b: 42 } });
        options.ifArg('b', (a) => {
          a.should.equal(42);
          ran = true;
        });
        ran.should.equal(true);
      });

      it('should return blank if the arg is not present', () => {
        QueryOptions.none.ifArg('z', () => {}).should.eql(sql``);
      });
    });
  });

  describe('postgresErrorToProblem', () => {
    const { postgresErrorToProblem } = util;
    const after = (times, f) => {
      let count = 0;
      return () => (++count === times) ? f() : null;
    };

    it('leaves non-error results alone', (done) => {
      const check = after(2, done);
      postgresErrorToProblem(0).catch((result) => {
        result.should.equal(0);
        check();
      });
      postgresErrorToProblem({ message: 'test' }).catch((result) => {
        result.should.eql({ message: 'test' });
        check();
      });
    });

    it('leaves already-Problems alone', (done) => {
      const problem = Problem.internal.unknown();
      postgresErrorToProblem(problem).catch((result) => {
        result.should.equal(problem); // hard ref equals
        done();
      });
    });

    // for the following, we can't hope to be truly exhaustive nor to be immune
    // to postgres-side changes, so just give them a cursory whirl.
    // separate integration tests check that the database actually gives us
    // errors in these formats.
    const errorWith = (properties) => {
      const result = new Error();
      for (const key of Object.keys(properties))
        result[key] = properties[key];
      return result;
    };
    it('recognizes not_null_violation', (done) => {
      postgresErrorToProblem(errorWith({ code: '23502', column: 42 })).catch((result) => {
        result.problemCode.should.equal(400.2);
        result.problemDetails.should.eql({ field: 42 });
        done();
      });
    });

    it('recognizes unique_violation', (done) => {
      postgresErrorToProblem(errorWith({ code: '23505', detail: 'Key (x)=(42) already exists.' })).catch((result) => {
        result.problemCode.should.equal(409.3);
        result.problemDetails.fields.should.eql([ 'x' ]);
        result.problemDetails.values.should.eql([ '42' ]);
        done();
      });
    });

    it('recognizes and parses multi-column unique_violation', (done) => { // github #93
      postgresErrorToProblem(errorWith({ code: '23505', detail: 'Key ("xmlFormId", version)=(widgets, 1) already exists.' })).catch((result) => {
        result.problemCode.should.equal(409.3);
        result.problemDetails.fields.should.eql([ 'xmlFormId', 'version' ]);
        result.problemDetails.values.should.eql([ 'widgets', '1' ]);
        done();
      });
    });

    it('recognizes undefined_column', (done) => {
      postgresErrorToProblem(errorWith({ code: '42703', message: 'column "test" of relation "aa" does not exist' })).catch((result) => {
        result.problemCode.should.equal(400.4);
        result.problemDetails.field.should.equal('test');
        done();
      });
    });
  });
});

