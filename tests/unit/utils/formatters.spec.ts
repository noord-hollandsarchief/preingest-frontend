import { formatDateString, formatDateDifference } from '@/utils/formatters';
import dayjs from 'dayjs';

describe('formatDateString', () => {
  const f = formatDateString;
  it('returns no result if parameter is undefined', () => {
    expect(f(undefined)).toBeUndefined();
  });
});

describe('formatDateDifference', () => {
  const f = formatDateDifference;

  it('always uses leading zero for seconds', () => {
    // Zero
    expect(f('2020-12-28T18:09:05.00', '2020-12-28T18:09:05.00')).toEqual('0.00');
    // Close to zero
    expect(f('2020-12-28T18:09:05.00', '2020-12-28T18:09:05.10')).toEqual('0.00');
    // 1 second
    expect(f('2020-12-28T18:09:05.00', '2020-12-28T18:09:06.00')).toEqual('0.01');
    // 59 seconds
    expect(f('2020-12-28T18:09:05.00', '2020-12-28T18:10:04.00')).toEqual('0.59');
  });

  it('does not use leading zero for minutes if less than an hour', () => {
    // 60 seconds
    expect(f('2020-12-28T18:09:05.00', '2020-12-28T18:10:05.00')).toEqual('1.00');
    // 59 minutes
    expect(f('2020-12-28T18:09:05.00', '2020-12-28T19:08:05.00')).toEqual('59.00');
  });

  it('uses leading zero for minutes if more than an hour', () => {
    // 1 hour; leading zero for minutes
    expect(f('2020-12-28T18:09:05.00', '2020-12-28T19:09:05.00')).toEqual('1:00.00');
  });

  it('does not limit hours to a single day', () => {
    // 1 hour; leading zero for minutes
    expect(f('2020-12-28T18:09:05.00', '2020-12-29T19:09:05.00')).toEqual('25:00.00');
  });

  it('handles daylight saving time', () => {
    // Start of summer time should not affect the string date/time inputs
    expect(f('2021-03-28T02:00:00.00+00:00', '2021-03-28T04:00:00.00+00:00')).toEqual('2:00.00');
    // ...unless no timezone is given at all, in which case the results depends on some assumption
    expect(f('2021-03-28T02:00:00.00', '2021-03-28T04:00:00.00')).toEqual('1:00.00');
  });

  it('uses the current time if no end time is given', () => {
    expect(f('2021-03-28T02:00:00.00+00:00')).toEqual(
      f('2021-03-28T02:00:00.00+00:00', dayjs().toISOString())
    );
  });
});
