# User Manual

A guide to using Dress Asset Management — the app your group uses to track
shared costumes, see who has what, and request or hand off items.

This manual is for everyday users, admins, and superadmins. If you're
deploying your own instance of the app, see
[installation.md](installation.md) instead.

## 1. Roles

Every member has a role **per group**:

- **User** — can browse the catalog, request items/kits, comment, and view
  history. Can also transfer an item they currently hold or own to someone
  else.
- **Admin** — everything a User can do, plus managing the catalog
  (categories, products, items, kits) and directly changing an item's
  holder/owner.
- **Superadmin** — everything an Admin can do, plus managing members' roles
  and creating new Groups.

## 2. Signing in and joining

1. Go to the app's web address and sign in with Google.
2. **First time setting up a new organization?** You'll be asked to create
   an Organization (Subscription) and a first Group — you become its
   superadmin.
3. **Joining an existing organization?** An admin will send you an invite
   link (`.../join/<id>`). Sign in, open the link, and you're added as a
   `user` to every Group in that organization. An admin can promote you
   afterward from the Members page.

## 3. Groups

A **Group** is a division within your organization — for example age
categories like *Seniors*, *Youth*, and *Middle-aged*. Every Category,
Product, Item, and Kit belongs to exactly one Group.

- Go to **Groups** in the sidebar to see existing groups.
- Superadmins can click **Add Group** to create a new one (name +
  optional description). You automatically become superadmin of any group
  you create.
- Admins/superadmins assign members to groups (and set their role in each)
  from the **Members** page.

## 4. Your profile

Open **Profile** to set:

- **Gender** — used to match you with the right items when requesting kits.
- **Size per category** — a shoe size and a dress size aren't the same
  scale, so you set one size per Category (e.g. "Dress: M", "Shoes: 42").
  Set this before requesting a kit that includes that category, or the
  request will fail with a clear error telling you which size is missing.

## 5. Building the catalog (Admin/Superadmin)

The catalog is organized as **Category → Product → Item**, plus **Kits**:

- **Categories** — broad groupings, e.g. "Dress", "Shoes", "Trousers".
- **Products** — a specific variant within a category, e.g. "Red Floral
  Skirt". Has a gender and can have a photo.
- **Items** — the actual physical pieces you own, e.g. three "Red Floral
  Skirt" items in sizes S/M/L. Each item has a size, condition, optional
  RFID tag ID, optional description, and belongs to one Group.
- **Kits** — a named set of specific Products that together make a
  complete costume (e.g. "Wedding Costume A" = a specific dress + specific
  shoes). Members request the whole kit at once; the system finds an
  available item of each required product in the requester's size/gender
  automatically.

Every Category/Product/Item/Kit must be assigned to a **Group** when
created.

## 6. Requesting an item or kit

- **Browse Items** and open one you want. If it's not already yours, click
  **Request Transfer** (or **Request from Storage** if nobody currently
  holds it). This sends a request to whoever currently holds it (or to an
  admin) for approval.
- **Browse Kits** and click **Request Kit** to request a full costume set
  at once. The system automatically picks one available item per required
  product matching your size and gender.
- Track the status of your requests, and act on requests directed at you,
  from **Requests** in the sidebar.

## 7. Transferring an item

There are two ways an item moves from one person to another:

1. **Someone requests it from you** (see above) — it shows up in your
   **Requests** inbox as something to *Approve & Transfer* or *Decline*.
2. **You hand it off to someone specific** — if you're the current holder
   or the owner of an item, open its detail page and use the
   **Transfer to...** picker near the top: choose a person and click
   **Send Transfer Offer**. It appears in *their* Requests inbox as an
   offer they must *Accept & Transfer* or *Decline* before it actually
   becomes theirs.

Either way, every completed transfer is recorded in the item's **History**
tab, so you can always see who has held an item and when.

Admins/superadmins have a third option: on an item's detail page, the
**Current Holder** and **Owner** fields are editable dropdowns, letting
them reassign either directly (holder changes are still logged to
History; owner changes are not, since owner is just long-term bookkeeping,
separate from who physically has the item right now).

## 8. Item detail page

Click any item (from the Items list, or via a request) to see:

- Photo, RFID tag, size, condition, description.
- **Current Holder** / **Owner** — who has it right now vs. who it's
  long-term assigned to. These are different: you might hold an item that
  belongs to someone else, or that's simply unassigned.
- **Comments** — leave notes for other members about the item's condition,
  fit, etc.
- **History** — every holder change, with date, who initiated it, and how
  (request, admin override, or NFC scan).

## 9. Members and roles (Admin/Superadmin)

Open **Members** to see everyone in the organization and their role in each
Group. Change a dropdown to promote/demote someone, or set "None" to
remove them from a group entirely.

## 10. NFC mobile scanner

A companion mobile app is planned for tapping a garment's NFC tag to
instantly identify it and do a quick check-out/return — useful backstage
where typing on a laptop isn't practical. It is not yet available; when it
ships, it will sign in with the same account you use on the web app.

## Tips

- If a kit request fails saying a size is missing, go to **Profile** and
  set your size for the category it mentions.
- If a kit request fails saying no item is available, someone needs to
  return an item of that product/size/gender to Storage before the kit can
  be fulfilled.
- "Storage" as a holder means the item isn't checked out — it's available.
