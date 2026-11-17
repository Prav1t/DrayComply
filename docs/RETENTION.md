# Retention policy

DRAFT - the periods below are proposals. Agree them, then have the privacy policy reviewed against them.

| What | Kept for | Why | How it ends |
|---|---|---|---|
| Uploaded files, driver roster, templates, runs, results, reports | While the organization's account is open | The Commissioner audits back to April 3, 2014; a customer needs old runs to answer one | The owner deletes the organization in Settings, or asks us to |
| Superseded versions of a file | Same as above | Earlier runs read them; a run must stay reproducible | Deleted with the organization |
| Activity log | Same as above | Shows who ran and downloaded what | Deleted with the organization |
| Account (name, email, password hash) | Until the person's last membership ends, then 90 days | Lets them be re-invited | Manual deletion for now |
| Sessions | 14 days | Sign-in | `npm run db:purge-expired`, daily |
| Sign-in attempt records (hashed keys only) | 24 hours | Rate limiting | Same command |
| Deletion receipts (organization id, counts, date) | Indefinitely | Proof that a deletion happened. Holds no customer data | Never |
| Database backups | 7 days, set by the provider | Recovery | Roll off automatically. A deleted organization is gone from backups within 7 days; the privacy policy says 35 to leave room for a longer plan |
| Application logs | 30 days at most | Fault finding. They hold route names, status codes and ids, never payroll data | Host log retention setting |

After an account closes: the customer has 30 days to ask for an export, then the organization is deleted.

A driver's request to see, correct or delete their information goes to the licensee, who controls it. Deleting one driver's records out of a stored run is not possible, because runs are immutable; the licensee can delete the organization's data as a whole.
