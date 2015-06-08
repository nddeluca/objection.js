var _ = require('lodash');
var expect = require('expect.js');
var Promise = require('bluebird');
var transaction = require('../../lib/moronTransaction');

module.exports = function (session) {
  var Model1 = session.models.Model1;
  var Model2 = session.models.Model2;

  describe('transaction', function () {

    beforeEach(function () {
      return session.populate([]);
    });

    it('should resolve an empty transaction', function (done) {
      transaction(Model1, Model2, function (Model1, Model2) {
        return {a: 1};
      }).then(function (result) {
        expect(result).to.eql({a: 1});
        done();
      });
    });

    it('should commit transaction if no errors occur', function (done) {
      transaction(Model1, Model2, function (Model1, Model2) {

        return Model1
          .query()
          .insert({model1Prop1: 'test 1'})
          .then(function () {
            return Model1.query().insert({model1Prop1: 'test 2'});
          })
          .then(function () {
            return Model2.query().insert({model2Prop1: 'test 3'});
          });

      }).then(function (result) {
        expect(result.model2Prop1).to.equal('test 3');
        return session.knex('Model1');
      }).then(function (rows) {
        expect(rows).to.have.length(2);
        expect(_.pluck(rows, 'model1Prop1').sort()).to.eql(['test 1', 'test 2']);
        return session.knex('model_2');
      }).then(function (rows) {
        expect(rows).to.have.length(1);
        expect(rows[0].model_2_prop_1).to.equal('test 3');
        done();
      }).catch(done);

    });

    it('should rollback if an error occurs (1)', function (done) {
      transaction(Model1, Model2, function (Model1, Model2) {

        return Model1
          .query()
          .insert({model1Prop1: 'test 1'})
          .then(function () {
            return Model1.query().insert({model1Prop1: 'test 2'});
          })
          .then(function () {
            return Model2.query().insert({model2Prop1: 'test 3'});
          })
          .then(function () {
            throw new Error();
          });

      }).catch(function () {
        return session.knex('Model1');
      }).then(function (rows) {
        expect(rows).to.have.length(0);
        return session.knex('model_2');
      }).then(function (rows) {
        expect(rows).to.have.length(0);
        done();
      }).catch(done);

    });

    it('should rollback if an error occurs (2)', function (done) {
      transaction(Model1, function (Model1) {

        return Model1
          .query()
          .insert({model1Prop1: 'test 1'})
          .then(function (model) {
            return model.$relatedQuery('model1Relation2').insert({model2Prop2: 1000});
          })
          .then(function () {
            throw new Error();
          });

      }).catch(function () {
        return session.knex('Model1');
      }).then(function (rows) {
        expect(rows).to.have.length(0);
        return session.knex('model_2');
      }).then(function (rows) {
        expect(rows).to.have.length(0);
        done();
      }).catch(done);

    });

    it('should skip queries after rollback)', function (done) {
      console.log('The following stacktrace is not an error. It should be there!');
      transaction(Model1, function (Model1) {

        return Model1.query().insert({model1Prop1: '123'}).then(function () {
          return Promise.all(_.map(_.range(2), function (i) {
            if (i === 1) {
              throw new Error();
            }
            return Model1.query().insert({model1Prop1: i.toString()}).then();
          }));
        });

      }).catch(function () {
        return Promise.delay(5).then(function () {
          return session.knex('Model1');
        });
      }).then(function (rows) {
        expect(rows).to.have.length(0);
        return session.knex('model_2');
      }).then(function (rows) {
        expect(rows).to.have.length(0);
        done();
      }).catch(done);

    });

  });
};
