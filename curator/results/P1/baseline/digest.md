# Eval results: `baseline` on puzzle P1

Rationale: Current production policy: show Jev the ticket's own records only.
Prediction: n/a

| Score | Value |
|---|---|
| Balanced accuracy (mean of per-queue accuracy) | 45.9% |
| Balanced soft score (mean probability on the right queue, per queue) | 41.9% |
| Plain accuracy | 44.5% |
| Confident but wrong (confidence > 0.8) | 58 tickets |
| Jev's mean confidence (0-1, needs no labels) | 0.73 |
| Cost | 156148 input tokens for 256 tickets |

| Queue | Tickets | Accuracy |
|---|---|---|
| no_action | 144 | 44% |
| billing | 69 | 48% |
| account_access | 27 | 30% |
| shipping | 16 | 62% |

Accuracy by region (4 accounts x 4 weeks per cell):

| accounts \ weeks | W00-03 | W04-07 | W08-11 | W12-15 |
|---|---|---|---|---|
| A00-03 | 31% | 56% | 31% | 25% |
| A04-07 | 31% | 38% | 50% | 50% |
| A08-11 | 62% | 44% | 62% | 62% |
| A12-15 | 50% | 44% | 31% | 44% |

Jev's mean confidence by region (4 accounts x 4 weeks per cell):

| accounts \ weeks | W00-03 | W04-07 | W08-11 | W12-15 |
|---|---|---|---|---|
| A00-03 | 0.68 | 0.75 | 0.71 | 0.71 |
| A04-07 | 0.78 | 0.66 | 0.71 | 0.74 |
| A08-11 | 0.73 | 0.77 | 0.67 | 0.76 |
| A12-15 | 0.70 | 0.80 | 0.74 | 0.79 |

`render.png` is Jev's routing map: accounts are rows, weeks are columns, and each ticket is drawn in the probability-weighted mix of its queues' colors (see `palette.json`). Correct routing draws a clean picture.

## Traces: worst-routed tickets (10)

### Ticket A00-W09: WRONG. Right queue no_action; Jev said legal 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A00 in week 9 (ticket A00-W09).
Records:
- [event-log] Ticket A00-W09 event: data_export_requested
- [analytics-export] Ticket A00-W09 topic cluster: admin-and-compliance
```

### Ticket A03-W01: WRONG. Right queue shipping; Jev said returns 43%, no_action 41%, technical 15% (confidence 0.37)

```
Support ticket from account A03 in week 1 (ticket A03-W01).
Records:
- [event-log] Ticket A03-W01 event: order_or_return_page
```

### Ticket A02-W10: WRONG. Right queue no_action; Jev said legal 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A02 in week 10 (ticket A02-W10).
Records:
- [analytics-export] Ticket A02-W10 topic cluster: admin-and-compliance
```

### Ticket A03-W03: WRONG. Right queue billing; Jev said no_action 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A03 in week 3 (ticket A03-W03).
Records:
(no records)
```

### Ticket A03-W00: WRONG. Right queue account_access; Jev said technical 99%, no_action 1%, billing 0% (confidence 0.99)

```
Support ticket from account A03 in week 0 (ticket A03-W00).
Records:
- [customer-form] Ticket A03-W00: customer chose "Something isn't working"
```

### Ticket A02-W13: WRONG. Right queue no_action; Jev said legal 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A02 in week 13 (ticket A02-W13).
Records:
- [analytics-export] Ticket A02-W13 topic cluster: admin-and-compliance
```

### Ticket A07-W09: WRONG. Right queue billing; Jev said technical 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A07 in week 9 (ticket A07-W09).
Records:
- [customer-form] Ticket A07-W09: customer chose "Something isn't working"
```

### Ticket A07-W00: WRONG. Right queue account_access; Jev said technical 87%, no_action 11%, feedback 2% (confidence 0.86)

```
Support ticket from account A07 in week 0 (ticket A07-W00).
Records:
- [customer-form] Ticket A07-W00: customer chose "I need you to do something"
- [analytics-export] Ticket A07-W00 topic cluster: product-usage
```

### Ticket A06-W00: WRONG. Right queue account_access; Jev said technical 99%, no_action 1%, billing 0% (confidence 0.99)

```
Support ticket from account A06 in week 0 (ticket A06-W00).
Records:
- [customer-form] Ticket A06-W00: customer chose "Something isn't working"
```

### Ticket A06-W10: WRONG. Right queue billing; Jev said technical 99%, no_action 1%, billing 0% (confidence 0.99)

```
Support ticket from account A06 in week 10 (ticket A06-W10).
Records:
- [customer-form] Ticket A06-W10: customer chose "Something isn't working"
```


## Traces: random sample of tickets (20)

### Ticket A00-W03: WRONG. Right queue no_action; Jev said billing 47%, no_action 34%, refunds 10% (confidence 0.41)

```
Support ticket from account A00 in week 3 (ticket A00-W03).
Records:
- [event-log] Ticket A00-W03 event: reply_to_receipt_email
```

### Ticket A04-W04: WRONG. Right queue billing; Jev said technical 69%, billing 31%, refunds 0% (confidence 0.66)

```
Support ticket from account A04 in week 4 (ticket A04-W04).
Records:
- [event-log] Ticket A04-W04 event: payment_page_error
- [analytics-export] Ticket A04-W04 topic cluster: orders-and-delivery
- [customer-form] Ticket A04-W04: customer chose "Something isn't working"
```

### Ticket A04-W07: WRONG. Right queue no_action; Jev said legal 87%, no_action 9%, feedback 4% (confidence 0.85)

```
Support ticket from account A04 in week 7 (ticket A04-W07).
Records:
- [customer-form] Ticket A04-W07: customer chose "Just letting you know"
- [analytics-export] Ticket A04-W07 topic cluster: admin-and-compliance
```

### Ticket A05-W15: correct. Right queue no_action; Jev said no_action 76%, feedback 24%, billing 0% (confidence 0.73)

```
Support ticket from account A05 in week 15 (ticket A05-W15).
Records:
- [customer-form] Ticket A05-W15: customer chose "Just letting you know"
```

### Ticket A07-W01: correct. Right queue shipping; Jev said shipping 100%, billing 0%, refunds 0% (confidence 0.99)

```
Support ticket from account A07 in week 1 (ticket A07-W01).
Records:
- [analytics-export] Ticket A07-W01 topic cluster: orders-and-delivery
```

### Ticket A07-W05: WRONG. Right queue billing; Jev said technical 66%, billing 34%, refunds 0% (confidence 0.63)

```
Support ticket from account A07 in week 5 (ticket A07-W05).
Records:
- [analytics-export] Ticket A07-W05 topic cluster: payments
- [event-log] Ticket A07-W05 event: payment_page_error
```

### Ticket A07-W06: WRONG. Right queue billing; Jev said technical 63%, billing 37%, refunds 0% (confidence 0.59)

```
Support ticket from account A07 in week 6 (ticket A07-W06).
Records:
- [event-log] Ticket A07-W06 event: payment_page_error
- [customer-form] Ticket A07-W06: customer chose "Something isn't working"
```

### Ticket A08-W02: WRONG. Right queue shipping; Jev said returns 46%, no_action 31%, technical 22% (confidence 0.40)

```
Support ticket from account A08 in week 2 (ticket A08-W02).
Records:
- [event-log] Ticket A08-W02 event: order_or_return_page
```

### Ticket A08-W05: WRONG. Right queue billing; Jev said technical 62%, billing 38%, refunds 0% (confidence 0.58)

```
Support ticket from account A08 in week 5 (ticket A08-W05).
Records:
- [event-log] Ticket A08-W05 event: payment_page_error
- [customer-form] Ticket A08-W05: customer chose "Something isn't working"
```

### Ticket A09-W06: correct. Right queue billing; Jev said billing 57%, technical 43%, refunds 0% (confidence 0.53)

```
Support ticket from account A09 in week 6 (ticket A09-W06).
Records:
- [customer-form] Ticket A09-W06: customer chose "Something isn't working"
- [analytics-export] Ticket A09-W06 topic cluster: payments
- [event-log] Ticket A09-W06 event: payment_page_error
```

### Ticket A10-W12: correct. Right queue shipping; Jev said shipping 100%, billing 0%, refunds 0% (confidence 1.00)

```
Support ticket from account A10 in week 12 (ticket A10-W12).
Records:
- [analytics-export] Ticket A10-W12 topic cluster: orders-and-delivery
```

### Ticket A11-W01: correct. Right queue no_action; Jev said no_action 45%, billing 39%, refunds 8% (confidence 0.40)

```
Support ticket from account A11 in week 1 (ticket A11-W01).
Records:
- [event-log] Ticket A11-W01 event: reply_to_receipt_email
```

### Ticket A11-W07: WRONG. Right queue billing; Jev said technical 53%, billing 47%, refunds 0% (confidence 0.48)

```
Support ticket from account A11 in week 7 (ticket A11-W07).
Records:
- [event-log] Ticket A11-W07 event: payment_page_error
```

### Ticket A11-W13: WRONG. Right queue account_access; Jev said technical 52%, billing 48%, refunds 0% (confidence 0.47)

```
Support ticket from account A11 in week 13 (ticket A11-W13).
Records:
- [customer-form] Ticket A11-W13: customer chose "Something isn't working"
- [event-log] Ticket A11-W13 event: payment_page_error
```

### Ticket A12-W15: WRONG. Right queue no_action; Jev said legal 80%, no_action 13%, billing 3% (confidence 0.77)

```
Support ticket from account A12 in week 15 (ticket A12-W15).
Records:
- [analytics-export] Ticket A12-W15 topic cluster: admin-and-compliance
- [event-log] Ticket A12-W15 event: reply_to_receipt_email
```

### Ticket A13-W11: correct. Right queue no_action; Jev said no_action 49%, legal 43%, feedback 7% (confidence 0.44)

```
Support ticket from account A13 in week 11 (ticket A13-W11).
Records:
- [analytics-export] Ticket A13-W11 topic cluster: admin-and-compliance
- [customer-form] Ticket A13-W11: customer chose "Just letting you know"
- [event-log] Ticket A13-W11 event: reply_to_receipt_email
```

### Ticket A14-W02: correct. Right queue no_action; Jev said no_action 83%, feedback 15%, billing 2% (confidence 0.81)

```
Support ticket from account A14 in week 2 (ticket A14-W02).
Records:
- [event-log] Ticket A14-W02 event: reply_to_receipt_email
- [customer-form] Ticket A14-W02: customer chose "Just letting you know"
```

### Ticket A15-W02: WRONG. Right queue no_action; Jev said legal 81%, no_action 14%, feedback 5% (confidence 0.79)

```
Support ticket from account A15 in week 2 (ticket A15-W02).
Records:
- [customer-form] Ticket A15-W02: customer chose "Just letting you know"
- [analytics-export] Ticket A15-W02 topic cluster: admin-and-compliance
```

### Ticket A15-W07: correct. Right queue no_action; Jev said no_action 68%, legal 27%, feedback 5% (confidence 0.63)

```
Support ticket from account A15 in week 7 (ticket A15-W07).
Records:
- [analytics-export] Ticket A15-W07 topic cluster: admin-and-compliance
- [event-log] Ticket A15-W07 event: reply_to_receipt_email
- [customer-form] Ticket A15-W07: customer chose "Just letting you know"
```

### Ticket A15-W15: correct. Right queue no_action; Jev said no_action 47%, billing 34%, refunds 12% (confidence 0.42)

```
Support ticket from account A15 in week 15 (ticket A15-W15).
Records:
- [event-log] Ticket A15-W15 event: reply_to_receipt_email
```
