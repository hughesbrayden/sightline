# Eval results: `iter_02` on puzzle P1

Rationale: LEARNED (iter_01, glosses on own records, BA 71.2% vs 45.9%, predicted 68%): the vocabulary hypothesis was confirmed. Per-queue accuracy was no_action 99%, billing 88%, shipping 75%, account_access 22% (down from 30%). Legal/technical/returns answers disappeared for glossed values, and Jev followed every gloss. What remains is concentrated in account_access, which is the costliest queue for BA (each ticket is worth ~0.9 BA points). Account_access tickets carry values I had not glossed, and Jev maps them to decoy queues: login_or_device_alert gave security ~60% / account_access ~40% on both traces, both truly account_access (A09-W14, A12-W09); product-usage gave technical, truly account_access on 2 of 3 traces (A07-W00, A13-W07; the third was no_action alongside reply_to_receipt_email); identity was account_access 1/1; pricing_or_survey_page gave sales 98%, truly account_access (A12-W11); 'I have a question' gave no_action 90%, truly account_access (A09-W01); 'I need you to do something' gave technical, truly account_access (A07-W00). None of these values has been seen on a billing or shipping ticket. All 33 traced no_action tickets carried only canonical no_action values, apart from one 'Something isn't working' and one product-usage. The render shows ~13 cells with security mass and several technical/sales cells, all on the rim of the billing blob, where the traced account_access tickets sit. The other remaining errors are no-record tickets (4 billing and 1 account_access in the worst 10, all sent to no_action at 100%) and the lone 'Something isn't working' tickets that Jev splits ~50/50 billing/account_access; both need neighbor context, which is deferred to the next run. HYPOTHESIS: most account_access losses are the same vocabulary problem. This run changes ONE thing vs iter_01: it adds glosses for the six account_access-associated values (strong: login_or_device_alert, identity, product-usage; weak, n=1 each, worded more softly: pricing_or_survey_page, 'I have a question', 'I need you to do something'). Everything else is identical, including the raw format and own records only. CONFIRM: account_access >= 45% with security/technical/sales answers largely gone from traces, and no_action still >= 95%. REFUTE: account_access < 35%, or no_action falls below 93% because the soft glosses pull no_action tickets into account_access. That would show which weak gloss to drop.
Prediction: balanced accuracy ~78%

| Score | Value |
|---|---|
| Balanced accuracy (mean of per-queue accuracy) | 84.6% |
| Balanced soft score (mean probability on the right queue, per queue) | 84.4% |
| Plain accuracy | 91.4% |
| Confident but wrong (confidence > 0.8) | 9 tickets |
| Jev's mean confidence (0-1, needs no labels) | 0.94 |
| Cost | 162158 input tokens for 256 tickets |

| Queue | Tickets | Accuracy |
|---|---|---|
| no_action | 144 | 97% |
| billing | 69 | 88% |
| account_access | 27 | 78% |
| shipping | 16 | 75% |

Accuracy by region (4 accounts x 4 weeks per cell):

| accounts \ weeks | W00-03 | W04-07 | W08-11 | W12-15 |
|---|---|---|---|---|
| A00-03 | 88% | 88% | 100% | 100% |
| A04-07 | 62% | 88% | 100% | 94% |
| A08-11 | 94% | 81% | 94% | 88% |
| A12-15 | 94% | 100% | 94% | 100% |

Jev's mean confidence by region (4 accounts x 4 weeks per cell):

| accounts \ weeks | W00-03 | W04-07 | W08-11 | W12-15 |
|---|---|---|---|---|
| A00-03 | 0.97 | 0.98 | 0.94 | 0.98 |
| A04-07 | 0.84 | 0.96 | 0.93 | 0.94 |
| A08-11 | 0.94 | 0.90 | 0.92 | 0.98 |
| A12-15 | 0.93 | 0.98 | 0.95 | 0.98 |

`render.png` is Jev's routing map: accounts are rows, weeks are columns, and each ticket is drawn in the probability-weighted mix of its queues' colors (see `palette.json`). Correct routing draws a clean picture.

## Traces: worst-routed tickets (10)

### Ticket A01-W05: WRONG. Right queue no_action; Jev said account_access 98%, technical 2%, billing 0% (confidence 0.97)

```
Support ticket from account A01 in week 5 (ticket A01-W05).
Records:
- [analytics-export] Ticket A01-W05 topic cluster: product-usage (in past routing usually account_access (trouble getting into the product), rarely technical)
```

### Ticket A03-W03: WRONG. Right queue billing; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A03 in week 3 (ticket A03-W03).
Records:
(no records)
```

### Ticket A05-W07: WRONG. Right queue billing; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A05 in week 7 (ticket A05-W07).
Records:
(no records)
```

### Ticket A04-W02: WRONG. Right queue billing; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A04 in week 2 (ticket A04-W02).
Records:
(no records)
```

### Ticket A07-W03: WRONG. Right queue billing; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A07 in week 3 (ticket A07-W03).
Records:
(no records)
```

### Ticket A11-W13: WRONG. Right queue account_access; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A11 in week 13 (ticket A11-W13).
Records:
- [customer-form] Ticket A11-W13: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [event-log] Ticket A11-W13 event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
```

### Ticket A11-W04: WRONG. Right queue shipping; Jev said billing 64%, account_access 34%, technical 2% (confidence 0.60)

```
Support ticket from account A11 in week 4 (ticket A11-W04).
Records:
- [customer-form] Ticket A11-W04: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
```

### Ticket A09-W15: WRONG. Right queue account_access; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A09 in week 15 (ticket A09-W15).
Records:
(no records)
```

### Ticket A10-W06: WRONG. Right queue billing; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A10 in week 6 (ticket A10-W06).
Records:
(no records)
```

### Ticket A11-W05: WRONG. Right queue shipping; Jev said billing 60%, account_access 38%, technical 2% (confidence 0.56)

```
Support ticket from account A11 in week 5 (ticket A11-W05).
Records:
- [customer-form] Ticket A11-W05: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
```


## Traces: random sample of tickets (20)

### Ticket A00-W11: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A00 in week 11 (ticket A00-W11).
Records:
- [customer-form] Ticket A00-W11: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] Ticket A00-W11 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
```

### Ticket A00-W15: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A00 in week 15 (ticket A00-W15).
Records:
- [event-log] Ticket A00-W15 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [customer-form] Ticket A00-W15: customer chose "Just letting you know (in past routing usually no_action)"
```

### Ticket A01-W12: correct. Right queue no_action; Jev said no_action 99%, legal 1%, billing 0% (confidence 0.99)

```
Support ticket from account A01 in week 12 (ticket A01-W12).
Records:
- [event-log] Ticket A01-W12 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [customer-form] Ticket A01-W12: customer chose "Just letting you know (in past routing usually no_action)"
- [analytics-export] Ticket A01-W12 topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
```

### Ticket A04-W14: correct. Right queue no_action; Jev said no_action 96%, legal 4%, billing 0% (confidence 0.95)

```
Support ticket from account A04 in week 14 (ticket A04-W14).
Records:
- [analytics-export] Ticket A04-W14 topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
```

### Ticket A05-W04: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A05 in week 4 (ticket A05-W04).
Records:
- [analytics-export] Ticket A05-W04 topic cluster: payments (in past routing usually billing)
- [customer-form] Ticket A05-W04: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [event-log] Ticket A05-W04 event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
```

### Ticket A05-W13: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A05 in week 13 (ticket A05-W13).
Records:
- [customer-form] Ticket A05-W13: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] Ticket A05-W13 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
```

### Ticket A06-W00: WRONG. Right queue account_access; Jev said billing 65%, account_access 34%, technical 1% (confidence 0.61)

```
Support ticket from account A06 in week 0 (ticket A06-W00).
Records:
- [customer-form] Ticket A06-W00: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
```

### Ticket A06-W13: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A06 in week 13 (ticket A06-W13).
Records:
- [customer-form] Ticket A06-W13: customer chose "Just letting you know (in past routing usually no_action)"
- [event-log] Ticket A06-W13 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
```

### Ticket A07-W07: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A07 in week 7 (ticket A07-W07).
Records:
- [event-log] Ticket A07-W07 event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
```

### Ticket A08-W00: correct. Right queue no_action; Jev said no_action 99%, feedback 1%, billing 0% (confidence 0.98)

```
Support ticket from account A08 in week 0 (ticket A08-W00).
Records:
- [customer-form] Ticket A08-W00: customer chose "Just letting you know (in past routing usually no_action)"
```

### Ticket A08-W15: correct. Right queue account_access; Jev said account_access 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A08 in week 15 (ticket A08-W15).
Records:
- [customer-form] Ticket A08-W15: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [analytics-export] Ticket A08-W15 topic cluster: identity (in past routing usually account_access (login, password, 2FA), rarely security)
- [event-log] Ticket A08-W15 event: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security)
```

### Ticket A09-W01: correct. Right queue account_access; Jev said account_access 99%, no_action 1%, billing 0% (confidence 0.99)

```
Support ticket from account A09 in week 1 (ticket A09-W01).
Records:
- [customer-form] Ticket A09-W01: customer chose "I have a question (in past routing seen on account_access tickets, not sales)"
```

### Ticket A09-W13: correct. Right queue shipping; Jev said shipping 94%, technical 5%, billing 1% (confidence 0.93)

```
Support ticket from account A09 in week 13 (ticket A09-W13).
Records:
- [analytics-export] Ticket A09-W13 topic cluster: orders-and-delivery (in past routing usually shipping)
- [customer-form] Ticket A09-W13: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
```

### Ticket A10-W08: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A10 in week 8 (ticket A10-W08).
Records:
- [event-log] Ticket A10-W08 event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
- [customer-form] Ticket A10-W08: customer chose "Something isn't working (vague; in past routing usually billing or account_access, rarely technical)"
- [analytics-export] Ticket A10-W08 topic cluster: payments (in past routing usually billing)
```

### Ticket A10-W15: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A10 in week 15 (ticket A10-W15).
Records:
- [event-log] Ticket A10-W15 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [customer-form] Ticket A10-W15: customer chose "Just letting you know (in past routing usually no_action)"
```

### Ticket A11-W07: correct. Right queue billing; Jev said billing 100%, refunds 0%, shipping 0% (confidence 1.00)

```
Support ticket from account A11 in week 7 (ticket A11-W07).
Records:
- [event-log] Ticket A11-W07 event: payment_page_error (in past routing usually billing (failed or declined payment), not technical)
```

### Ticket A11-W15: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A11 in week 15 (ticket A11-W15).
Records:
(no records)
```

### Ticket A12-W03: correct. Right queue no_action; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A12 in week 3 (ticket A12-W03).
Records:
- [analytics-export] Ticket A12-W03 topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
- [event-log] Ticket A12-W03 event: reply_to_receipt_email (in past routing usually no_action (reply to an automated receipt), not billing)
- [customer-form] Ticket A12-W03: customer chose "Just letting you know (in past routing usually no_action)"
```

### Ticket A12-W06: correct. Right queue account_access; Jev said account_access 99%, security 1%, billing 0% (confidence 0.99)

```
Support ticket from account A12 in week 6 (ticket A12-W06).
Records:
- [event-log] Ticket A12-W06 event: login_or_device_alert (in past routing usually account_access (locked out, 2FA or password trouble), rarely security)
```

### Ticket A14-W09: correct. Right queue no_action; Jev said no_action 97%, legal 3%, billing 0% (confidence 0.96)

```
Support ticket from account A14 in week 9 (ticket A14-W09).
Records:
- [analytics-export] Ticket A14-W09 topic cluster: admin-and-compliance (in past routing almost always no_action (routine admin notice), rarely legal)
```
