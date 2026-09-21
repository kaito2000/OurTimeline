import test from 'node:test';
import assert from 'node:assert/strict';
import { updateRemotePairAnniversaries, ensurePairExists } from '../js/supabaseClient.js';

test('updateRemotePairAnniversaries sends update to pairs table', async () => {
  let capturedTable = null;
  let capturedUpdate = null;
  let capturedEq = null;

  const mockClient = {
    from: (table) => {
      capturedTable = table;
      return {
        update: (payload) => {
          capturedUpdate = payload;
          return {
            eq: (col, val) => {
              capturedEq = { col, val };
              return {
                select: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: val,
                      ...payload
                    },
                    error: null
                  })
                })
              };
            }
          };
        }
      };
    }
  };

  const result = await updateRemotePairAnniversaries(mockClient, 'test-pair-123', '2022-04-01', '2025-06-01');

  assert.equal(capturedTable, 'pairs');
  assert.deepEqual(capturedUpdate, {
    anniversary_dating: '2022-04-01',
    anniversary_marriage: '2025-06-01'
  });
  assert.deepEqual(capturedEq, {
    col: 'id',
    val: 'test-pair-123'
  });
  assert.equal(result.anniversary_dating, '2022-04-01');
  assert.equal(result.anniversary_marriage, '2025-06-01');
});

test('ensurePairExists complements missing anniversaries on existing pair', async () => {
  let updatedPayload = null;

  const mockClient = {
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'pair-exist',
              anniversary_dating: null,
              anniversary_marriage: null
            },
            error: null
          })
        })
      }),
      update: (payload) => {
        updatedPayload = payload;
        return {
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'pair-exist',
                  ...payload
                },
                error: null
              })
            })
          })
        };
      },
      insert: (payload) => ({
        select: () => ({
          maybeSingle: async () => ({
            data: payload,
            error: null
          })
        })
      })
    })
  };

  const result = await ensurePairExists(mockClient, 'pair-exist', 'secret-abc', '2023-01-01', '2026-05-01');

  assert.deepEqual(updatedPayload, {
    anniversary_dating: '2023-01-01',
    anniversary_marriage: '2026-05-01'
  });
  assert.equal(result.anniversary_dating, '2023-01-01');
  assert.equal(result.anniversary_marriage, '2026-05-01');
});
