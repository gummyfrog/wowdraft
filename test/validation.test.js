const { expect } = require('chai');

describe('Input validation helpers', function () {
  function validateLeagueInput(body) {
    var errors = [];
    var season_length = parseInt(body.season_length);
    var rounds = parseInt(body.rounds);
    var req_dps = parseInt(body.req_dps);
    var req_healers = parseInt(body.req_healers);
    var req_tanks = parseInt(body.req_tanks);

    if (isNaN(season_length) || season_length < 1 || season_length > 52) errors.push('season_length must be 1-52');
    if (isNaN(rounds) || rounds < 1 || rounds > 20) errors.push('rounds must be 1-20');
    if (isNaN(req_dps) || req_dps < 0 || req_dps > 20) errors.push('req_dps must be 0-20');
    if (isNaN(req_healers) || req_healers < 0 || req_healers > 20) errors.push('req_healers must be 0-20');
    if (isNaN(req_tanks) || req_tanks < 0 || req_tanks > 20) errors.push('req_tanks must be 0-20');
    return errors;
  }

  it('should accept valid input', function () {
    var errors = validateLeagueInput({
      season_length: '8', rounds: '10', req_dps: '5', req_healers: '3', req_tanks: '2'
    });
    expect(errors).to.have.length(0);
  });

  it('should reject negative season_length', function () {
    var errors = validateLeagueInput({
      season_length: '-1', rounds: '10', req_dps: '5', req_healers: '3', req_tanks: '2'
    });
    expect(errors).to.include('season_length must be 1-52');
  });

  it('should reject rounds over 20', function () {
    var errors = validateLeagueInput({
      season_length: '8', rounds: '99', req_dps: '5', req_healers: '3', req_tanks: '2'
    });
    expect(errors).to.include('rounds must be 1-20');
  });

  it('should reject non-numeric input', function () {
    var errors = validateLeagueInput({
      season_length: 'abc', rounds: '10', req_dps: '5', req_healers: '3', req_tanks: '2'
    });
    expect(errors).to.include('season_length must be 1-52');
  });
});
