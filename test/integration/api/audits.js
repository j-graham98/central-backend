const should = require('should');
const { sql } = require('slonik');
const { plain } = require('../../util/util');
const { testService } = require('../setup');
const testData = require('../../data/xml');

const submitThree = (asAlice) =>
  asAlice.post('/v1/projects/1/forms/simple/submissions')
    .send(testData.instances.simple.one)
    .set('Content-Type', 'text/xml')
    .expect(200)
    .then(() => asAlice.post('/v1/projects/1/forms/simple/submissions')
      .send(testData.instances.simple.two)
      .set('Content-Type', 'text/xml')
      .expect(200))
    .then(() => asAlice.post('/v1/projects/1/forms/simple/submissions')
      .send(testData.instances.simple.three)
      .set('Content-Type', 'text/xml')
      .expect(200));

describe('/audits', () => {
  describe('GET', () => {
    it('should reject if the user cannot read audits', testService((service) =>
      service.login('chelsea', (asChelsea) =>
        asChelsea.get('/v1/audits').expect(403))));

    it('should return all activity', testService((service, { Projects, Users }) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/projects')
          .send({ name: 'audit project' })
          .expect(200)
          .then(({ body }) => body.id)
          .then((projectId) => asAlice.patch(`/v1/projects/${projectId}`)
            .send({ name: 'renamed audit project' })
            .expect(200)
            .then(() => asAlice.post('/v1/users')
              .send({ displayName: 'david', email: 'david@opendatakit.org' })
              .expect(200))
            .then(() => Promise.all([
              asAlice.get('/v1/audits').expect(200).then(({ body }) => body),
              Projects.getById(projectId).then((o) => o.get()),
              Users.getByEmail('alice@opendatakit.org').then((o) => o.get()),
              Users.getByEmail('david@opendatakit.org').then((o) => o.get())
            ]))
            .then(([ audits, project, alice, david ]) => {
              audits.length.should.equal(4);
              audits.forEach((audit) => { audit.should.be.an.Audit(); });

              audits[0].actorId.should.equal(alice.actor.id);
              audits[0].action.should.equal('user.create');
              audits[0].acteeId.should.equal(david.actor.acteeId);
              audits[0].details.should.eql({ data: {
                actorId: david.actor.id,
                email: 'david@opendatakit.org',
                mfaSecret: null,
                password: null
              } });
              audits[0].loggedAt.should.be.a.recentIsoDate();

              audits[1].actorId.should.equal(alice.actor.id);
              audits[1].action.should.equal('project.update');
              audits[1].acteeId.should.equal(project.acteeId);
              audits[1].details.should.eql({ data: { name: 'renamed audit project' } });
              audits[1].loggedAt.should.be.a.recentIsoDate();

              audits[2].actorId.should.equal(alice.actor.id);
              audits[2].action.should.equal('project.create');
              audits[2].acteeId.should.equal(project.acteeId);
              audits[2].details.should.eql({ data: { name: 'audit project' } });
              audits[2].loggedAt.should.be.a.recentIsoDate();

              audits[3].actorId.should.equal(alice.actor.id);
              audits[3].action.should.equal('user.session.create');
              audits[3].acteeId.should.equal(alice.actor.acteeId);
              audits[3].loggedAt.should.be.a.recentIsoDate();
            })))));

    it('should return extended data if requested', testService((service, { Projects, Forms, Users }) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/projects')
          .send({ name: 'audit project' })
          .expect(200)
          .then(({ body }) => body.id)
          .then((projectId) => asAlice.post(`/v1/projects/${projectId}/forms?publish=true`)
            .send(testData.forms.simple)
            .set('Content-Type', 'text/xml')
            .expect(200)
            .then(() => asAlice.post('/v1/users')
              .send({ displayName: 'david', email: 'david@opendatakit.org' })
              .expect(200))
            .then(() => Promise.all([
              asAlice.get('/v1/audits').set('X-Extended-Metadata', true)
                .expect(200).then(({ body }) => body),
              Projects.getById(projectId).then((o) => o.get())
                .then((project) => Forms.getByProjectAndXmlFormId(project.id, 'simple')
                  .then((o) => o.get())
                  .then((form) => [ project, form ])),
              Users.getByEmail('alice@opendatakit.org').then((o) => o.get()),
              Users.getByEmail('david@opendatakit.org').then((o) => o.get())
            ]))
            .then(([ audits, [ project, form ], alice, david ]) => {
              audits.length.should.equal(5);
              audits.forEach((audit) => { audit.should.be.an.Audit(); });

              audits[0].actorId.should.equal(alice.actor.id);
              audits[0].actor.should.eql(plain(alice.actor.forApi()));
              audits[0].action.should.equal('user.create');
              audits[0].acteeId.should.equal(david.actor.acteeId);
              audits[0].actee.should.eql(plain(david.actor.forApi()));
              audits[0].details.should.eql({ data: {
                actorId: david.actor.id,
                email: 'david@opendatakit.org',
                mfaSecret: null,
                password: null
              } });
              audits[0].loggedAt.should.be.a.recentIsoDate();

              audits[1].actorId.should.equal(alice.actor.id);
              audits[1].actor.should.eql(plain(alice.actor.forApi()));
              audits[1].action.should.equal('form.update.publish');
              audits[1].acteeId.should.equal(form.acteeId);
              audits[1].actee.should.eql(plain(form.forApi()));
              audits[1].details.should.eql({ newDefId: form.currentDefId });
              audits[1].loggedAt.should.be.a.recentIsoDate();

              audits[2].actorId.should.equal(alice.actor.id);
              audits[2].actor.should.eql(plain(alice.actor.forApi()));
              audits[2].action.should.equal('form.create');
              audits[2].acteeId.should.equal(form.acteeId);
              audits[2].actee.should.eql(plain(form.forApi()));
              should.not.exist(audits[2].details);
              audits[2].loggedAt.should.be.a.recentIsoDate();

              audits[3].actorId.should.equal(alice.actor.id);
              audits[3].actor.should.eql(plain(alice.actor.forApi()));
              audits[3].action.should.equal('project.create');
              audits[3].acteeId.should.equal(project.acteeId);
              audits[3].actee.should.eql(plain(project.forApi()));
              audits[3].details.should.eql({ data: { name: 'audit project' } });
              audits[3].loggedAt.should.be.a.recentIsoDate();

              audits[4].actorId.should.equal(alice.actor.id);
              audits[4].actor.should.eql(plain(alice.actor.forApi()));
              audits[4].action.should.equal('user.session.create');
              audits[4].acteeId.should.equal(alice.actor.acteeId);
              audits[4].actee.should.eql(plain(alice.actor.forApi()));
              audits[4].loggedAt.should.be.a.recentIsoDate();
            })))));

    it('should not expand actor if there is no actor', testService((service, { run }) =>
      run(sql`insert into audits (action, "loggedAt") values ('backup', now())`)
        .then(() => service.login('alice', (asAlice) =>
          asAlice.get('/v1/audits?action=backup')
            .set('X-Extended-Metadata', true)
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(1);
              should.not.exist(body[0].actor);
            })))));

    it('should page data', testService((service, SubmissionDef) =>
      service.login('alice', (asAlice) =>
        submitThree(asAlice)
          .then(() => asAlice.get('/v1/audits?offset=1&limit=1')
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(1);
              body[0].details.instanceId.should.equal('two');
            })))));

    it('should page extended data', testService((service) =>
      service.login('alice', (asAlice) =>
        submitThree(asAlice)
          .then(() => asAlice.get('/v1/audits?offset=1&limit=1')
            .set('X-Extended-Metadata', true)
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(1);
              body[0].actor.displayName.should.equal('Alice');
              body[0].details.instanceId.should.equal('two');
              body[0].actee.xmlFormId.should.equal('simple');
            })))));

    it('should filter by action', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/projects')
          .send({ name: 'audit project' })
          .expect(200)
          .then(({ body }) => body.id)
          .then((projectId) => asAlice.post(`/v1/projects/${projectId}/forms`)
            .send(testData.forms.simple)
            .set('Content-Type', 'text/xml')
            .expect(200)
            .then(() => asAlice.post('/v1/users')
              .send({ displayName: 'david', email: 'david@opendatakit.org' })
              .expect(200))
            .then(() => asAlice.get('/v1/audits?action=form.create')
              .expect(200)
              .then(({ body }) => {
                body.length.should.equal(1);
                body[0].action.should.equal('form.create');
              }))))));

    // we don't test every single action. but we do exercise every category.
    it('should filter by action category (user)', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/projects')
          .send({ name: 'audit project' })
          .expect(200)
          .then(() => asAlice.post('/v1/users')
            .send({ displayName: 'david', email: 'david@opendatakit.org' })
            .expect(200)
            .then(({ body }) => body.id)
            .then((davidId) => asAlice.patch(`/v1/users/${davidId}`)
              .send({ displayName: 'David' })
              .expect(200)
              .then(() => asAlice.post(`/v1/assignments/admin/${davidId}`)
                .expect(200))
              .then(() => asAlice.delete(`/v1/assignments/admin/${davidId}`)
                .expect(200))
              .then(() => asAlice.delete(`/v1/users/${davidId}`)
                .expect(200))))
          .then(() => asAlice.get('/v1/audits?action=user')
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(6);
              body[0].action.should.equal('user.delete');
              body[1].action.should.equal('user.assignment.delete');
              body[2].action.should.equal('user.assignment.create');
              body[3].action.should.equal('user.update');
              body[4].action.should.equal('user.create');
              body[5].action.should.equal('user.session.create');
            })))));

    it('should filter by action category (project)', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/projects')
          .send({ name: 'audit project' })
          .expect(200)
          .then(({ body }) => body.id)
          .then((projectId) => asAlice.patch(`/v1/projects/${projectId}`)
            .send({ name: 'Audit Project' })
            .expect(200)
            .then(() => asAlice.delete(`/v1/projects/${projectId}`)
              .expect(200)))
          .then(() => asAlice.post('/v1/users')
            .send({ displayName: 'david', email: 'david@opendatakit.org' })
            .expect(200))
          .then(() => asAlice.get('/v1/audits?action=project')
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(3);
              body[0].action.should.equal('project.delete');
              body[1].action.should.equal('project.update');
              body[2].action.should.equal('project.create');
            })))));

    it('should filter by action category (form)', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/projects')
          .send({ name: 'audit project' })
          .expect(200)
          .then(({ body }) => body.id)
          .then((projectId) => asAlice.post(`/v1/projects/${projectId}/forms`)
            .send(testData.forms.simple)
            .set('Content-Type', 'text/xml')
            .expect(200)
            .then(() => asAlice.patch(`/v1/projects/${projectId}/forms/simple`)
              .send({ state: 'closing' })
              .expect(200))
            .then(() => asAlice.delete(`/v1/projects/${projectId}/forms/simple`)
              .expect(200)))
          .then(() => asAlice.post('/v1/users')
            .send({ displayName: 'david', email: 'david@opendatakit.org' })
            .expect(200))
          .then(() => asAlice.get('/v1/audits?action=form')
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(3);
              body[0].action.should.equal('form.delete');
              body[1].action.should.equal('form.update');
              body[2].action.should.equal('form.create');
            })))));

    it('should filter by action category (submission)', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/projects')
          .send({ name: 'audit project' })
          .expect(200)
          .then(({ body }) => body.id)
          .then((projectId) => asAlice.post(`/v1/projects/${projectId}/forms?publish=true`)
            .send(testData.forms.simple)
            .set('Content-Type', 'text/xml')
            .expect(200)
            .then(() => asAlice.post(`/v1/projects/${projectId}/forms/simple/submissions`)
              .send(testData.instances.simple.one)
              .set('Content-Type', 'text/xml')
              .expect(200)))
          .then(() => asAlice.get('/v1/audits?action=submission')
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(1);
              body[0].action.should.equal('submission.create');
            })))));

    it('should filter extended data by action', testService((service) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/projects')
          .send({ name: 'audit project' })
          .expect(200)
          .then(({ body }) => body.id)
          .then((projectId) => asAlice.post(`/v1/projects/${projectId}/forms`)
            .send(testData.forms.simple)
            .set('Content-Type', 'text/xml')
            .expect(200)
            .then(() => asAlice.post('/v1/users')
              .send({ displayName: 'david', email: 'david@opendatakit.org' })
              .expect(200))
            .then(() => asAlice.get('/v1/audits?action=form.create')
              .set('X-Extended-Metadata', true)
              .expect(200)
              .then(({ body }) => {
                body.length.should.equal(1);
                body[0].action.should.equal('form.create');
                body[0].actor.displayName.should.equal('Alice');
                body[0].actee.xmlFormId.should.equal('simple');
              }))))));

    it('should filter (inclusively) by start date', testService((service, { run }) =>
      Promise.all(
        [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]
          .map((day) => run(sql`insert into audits ("loggedAt", action) values (${`2000-01-${day}T00:00Z`}, ${`test.${day}`})`))
      )
        .then(() => service.login('alice', (asAlice) =>
          asAlice.get('/v1/audits?start=2000-01-08Z')
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(4);

              body[0].action.should.equal('user.session.create');
              body[1].action.should.equal('test.10');
              body[1].loggedAt.should.equal('2000-01-10T00:00:00.000Z');
              body[2].action.should.equal('test.9');
              body[2].loggedAt.should.equal('2000-01-09T00:00:00.000Z');
              body[3].action.should.equal('test.8');
              body[3].loggedAt.should.equal('2000-01-08T00:00:00.000Z');
            })))));

    it('should filter by start date+time', testService((service, { run }) =>
      Promise.all(
        [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]
          .map((day) => run(sql`insert into audits ("loggedAt", action) values (${`2000-01-${day}T00:00Z`}, ${`test.${day}`})`))
      )
        .then(() => service.login('alice', (asAlice) =>
          asAlice.get('/v1/audits?start=2000-01-08T12:00Z')
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(3);

              body[0].action.should.equal('user.session.create');
              body[1].action.should.equal('test.10');
              body[1].loggedAt.should.equal('2000-01-10T00:00:00.000Z');
              body[2].action.should.equal('test.9');
              body[2].loggedAt.should.equal('2000-01-09T00:00:00.000Z');
            })))));

    it('should filter extended data by start date+time', testService((service, { Users, run }) =>
      Users.getByEmail('alice@opendatakit.org').then((o) => o.get())
        .then((alice) => Promise.all(
          [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]
            .map((day) => run(sql`insert into audits ("loggedAt", action, "actorId", "acteeId") values (${`2000-01-${day}T00:00Z`}, ${`test.${day}`}, ${alice.actor.id}, ${alice.actor.acteeId})`))
        )
          .then(() => service.login('alice', (asAlice) =>
            asAlice.get('/v1/audits?start=2000-01-08T12:00Z')
              .set('X-Extended-Metadata', true)
              .expect(200)
              .then(({ body }) => {
                body.length.should.equal(3);

                body[0].action.should.equal('user.session.create');
                body[1].action.should.equal('test.10');
                body[1].loggedAt.should.equal('2000-01-10T00:00:00.000Z');
                body[1].actor.displayName.should.equal('Alice');
                body[1].actee.displayName.should.equal('Alice');
                body[2].action.should.equal('test.9');
                body[2].loggedAt.should.equal('2000-01-09T00:00:00.000Z');
                body[2].actor.displayName.should.equal('Alice');
                body[2].actee.displayName.should.equal('Alice');
              }))))));

    it('should filter (inclusively) by end date', testService((service, { run }) =>
      Promise.all(
        [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]
          .map((day) => run(sql`insert into audits ("loggedAt", action) values (${`2000-01-${day}T00:00Z`}, ${`test.${day}`})`))
      )
        .then(() => service.login('alice', (asAlice) =>
          asAlice.get('/v1/audits?end=2000-01-03Z')
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(3);

              body[0].action.should.equal('test.3');
              body[0].loggedAt.should.equal('2000-01-03T00:00:00.000Z');
              body[1].action.should.equal('test.2');
              body[1].loggedAt.should.equal('2000-01-02T00:00:00.000Z');
              body[2].action.should.equal('test.1');
              body[2].loggedAt.should.equal('2000-01-01T00:00:00.000Z');
            })))));

    it('should filter by end date+time', testService((service, { run }) =>
      Promise.all(
        [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]
          .map((day) => run(sql`insert into audits ("loggedAt", action) values (${`2000-01-${day}T00:00Z`}, ${`test.${day}`})`))
      )
        .then(() => service.login('alice', (asAlice) =>
          asAlice.get('/v1/audits?end=2000-01-02T12:00Z')
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(2);

              body[0].action.should.equal('test.2');
              body[0].loggedAt.should.equal('2000-01-02T00:00:00.000Z');
              body[1].action.should.equal('test.1');
              body[1].loggedAt.should.equal('2000-01-01T00:00:00.000Z');
            })))));

    it('should filter extended data by end date+time', testService((service, { Users, run }) =>
      Users.getByEmail('alice@opendatakit.org').then((o) => o.get())
        .then((alice) => Promise.all(
          [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]
            .map((day) => run(sql`insert into audits ("loggedAt", action, "actorId", "acteeId") values (${`2000-01-${day}T00:00Z`}, ${`test.${day}`}, ${alice.actor.id}, ${alice.actor.acteeId})`))
        )
          .then(() => service.login('alice', (asAlice) =>
            asAlice.get('/v1/audits?end=2000-01-02T12:00Z')
              .set('X-Extended-Metadata', true)
              .expect(200)
              .then(({ body }) => {
                body.length.should.equal(2);

                body[0].action.should.equal('test.2');
                body[0].loggedAt.should.equal('2000-01-02T00:00:00.000Z');
                body[0].actor.displayName.should.equal('Alice');
                body[0].actee.displayName.should.equal('Alice');
                body[1].action.should.equal('test.1');
                body[1].loggedAt.should.equal('2000-01-01T00:00:00.000Z');
                body[1].actor.displayName.should.equal('Alice');
                body[1].actee.displayName.should.equal('Alice');
              }))))));

    it('should filter out submission and backup events given action=nonverbose', testService((service, { run }) =>
      service.login('alice', (asAlice) =>
        Promise.all([
          run(sql`insert into audits (action, "loggedAt", details) values ('backup', now(), '{"success":true}')`),
          asAlice.post('/v1/projects/1/forms?publish=true')
            .set('Content-Type', 'application/xml')
            .send(testData.forms.binaryType)
            .expect(200)
            .then(() => asAlice.post('/v1/projects/1/submission')
              .set('X-OpenRosa-Version', '1.0')
              .attach('xml_submission_file', Buffer.from(testData.instances.binaryType.both), { filename: 'data.xml' })
              .expect(201)
              .then(() => asAlice.post('/v1/projects/1/forms/binaryType/submissions/both/attachments/my_file1.mp4')
                .send('attachment')
                .expect(200)))
        ])
          .then(() => asAlice.get('/v1/audits?action=nonverbose')
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(3);
              body[0].action.should.equal('form.update.publish');
              body[1].action.should.equal('form.create');
              body[2].action.should.equal('user.session.create');
            })))));

    it('should log and return notes if given', testService((service, { run }) =>
      service.login('alice', (asAlice) =>
        asAlice.post('/v1/projects/1/forms?publish=true')
          .set('Content-Type', 'application/xml')
          .set('X-Action-Notes', 'doing this for fun%21')
          .send(testData.forms.binaryType)
          .expect(200)
          .then(() => asAlice.post('/v1/projects/1/submission')
            .set('X-OpenRosa-Version', '1.0')
            .set('X-Action-Notes', 'doing this for work')
            .attach('xml_submission_file', Buffer.from(testData.instances.binaryType.both), { filename: 'data.xml' })
            .expect(201))
          .then(() => asAlice.get('/v1/audits')
            .expect(200)
            .then(({ body }) => {
              body.length.should.equal(4);
              body[0].action.should.equal('submission.create');
              body[0].notes.should.equal('doing this for work');
              body[1].action.should.equal('form.update.publish');
              body[1].notes.should.equal('doing this for fun!');
              body[2].action.should.equal('form.create');
              body[2].notes.should.equal('doing this for fun!');
              body[3].action.should.equal('user.session.create');
            })))));
  });
});

