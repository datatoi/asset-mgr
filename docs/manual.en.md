# User Manual

Dress Asset Management helps your organization track shared costumes, see who
holds each garment, and request or offer items to other members.

Updated: 7 October 2026. This guide covers members, subscription owners and site
administrators. Button names below match the English interface. For deploying
an instance, see [installation.md](installation.md).
[Latviešu rokasgrāmata](manual.lv.md) · [Latvian Word copy](manual.lv.doc)

## 1. Roles and access

A **subscription** is your organization's workspace. It contains groups,
members and the costume catalog. Most roles apply to one group at a time.

| Role | What it allows |
| --- | --- |
| Joiner | Starting role after joining by invitation. If you have no active group role, the app shows only your Profile until a role is granted. |
| User | Browse the organization's catalog and history; request and comment on items in your group; offer items you hold or own to eligible members. |
| Admin | User actions plus managing the catalog and authorized member profiles in the administered group, and changing item owners/holders directly. |
| Superadmin | Admin actions plus assigning/removing roles and editing/deleting their group. Can create additional groups. |
| Subscription owner | Manage all groups, catalog and members in their own subscription, including roles and member removal. The approved applicant becomes the owner and first group's superadmin. |
| Site administrator | Review subscription requests, inspect subscriptions across this installation and rename subscriptions. This access does not automatically grant catalog or transfer permissions inside another organization. |

A person can have different roles in different groups. Site administrator access
is assigned by the person who operates this installation; it cannot be granted
through the **Members** role dropdown.

## 2. Signing in and joining an organization

1. Ask your organization's administrator for an invitation link
   (`.../join/<subscription-id>`).
2. Open the link and click **Sign in with Google** if needed. Check that you are
   using the Google account you want to use for this organization.
3. Click **Join**, then **Go to Profile** after the success message.
4. Complete your profile while the subscription owner or a group superadmin
   grants you a `user`, `admin` or `superadmin` role in the appropriate group.

Joining grants `joiner` in every group that exists in that subscription at the
time you join. Profile-only access while waiting for a role is expected.

If you sign in at the main site without belonging to a subscription, you see
**You need an invitation link**. Ask your administrator for the link and open it.
Use **Sign out to use another account** if the displayed email is wrong.

An account can belong to only one subscription. To switch organizations, ask the
current subscription owner to remove your membership after your items and
pending transfers are resolved, then open the new organization's invitation.

## 3. Requesting a new subscription

Organizers who need a separate workspace must open **`/register` explicitly**.
The main sign-in flow is for joining an existing organization by invitation.

1. Open `/register` and sign in with Google.
2. Fill in **Organization name**, **First group name**, and
   **Why do you need a subscription?** All three are required. Explain whom your
   organization serves, which costumes you manage, and how you will use the app.
3. Click **Submit for approval**. You cannot use the new subscription or invite
   members until a site administrator approves it.
4. Return to `/register` and click **Check status** to see the decision.

- **Awaiting approval:** your submitted details are displayed while the request
  is pending.
- **Declined:** read the administrator's feedback, choose **Revise and resubmit**,
  update your details and submit again. **Cancel changes** returns to the status view.
- **Approved:** click **Open my organization** to enter **Administration**. Your
  subscription and first group are ready, and you are the subscription owner.

If you join an existing organization while your request is pending, that request
is closed. An account that already belongs to an organization cannot create an
additional subscription through this flow.

## 4. Organization administration and invitations

Owners and group admins/superadmins can open **Administration** (`/administration`)
from the sidebar, or **More** on a phone. It links to the member and catalog
management screens; group management is available to owners and superadmins.
Permissions continue to follow your role in each group.

To invite someone, choose **Copy invitation link** and send the link to the new
member. If copying fails, select and copy the link manually. An invitation link
is also available on the desktop Dashboard. Joining alone does not activate a
group role: an owner or the relevant superadmin must grant one in **Members**.

## 5. Groups

A group is a division such as *Seniors*, *Youth* or *Middle-aged*. Every category,
product, physical item and kit belongs to one group.

- Owners and superadmins can open **Groups** and choose **Add group**, entering
  a name and optional description. The creator becomes that group's superadmin.
- Owners can edit groups throughout their subscription; superadmins can edit
  their own groups.
- A group can be deleted only after its catalog is removed and pending transfers
  are closed. Keep at least one group in the subscription.
- Group roles are assigned in **Members** by the owner or that group's superadmin.

## 6. Your profile

Open **Profile** to set your name, gender, sizes and profile picture.

- **Gender:** Male or Female. It determines which category size fields are shown.
- **Size per category:** enter sizes separately, such as “Dress: M” and
  “Shoes: 42”. Only Unisex categories and categories matching your gender appear.
  Set gender first if the list is empty.
- **Profile picture:** saves immediately after upload. Use **Save Changes** for
  the other profile fields.

Use your profile sizes as a reference when selecting garments. Inventory bulk
requests use the exact items you select; they do not automatically replace them
with garments matching your profile.

## 7. Building and editing the catalog

Owners and authorized group admins/superadmins manage
**Category → Product → Item**, plus **Kits**:

- **Category:** a broad type such as Dress or Shoes, with Male/Female/Unisex gender.
- **Product:** a specific variant within a category, such as Red Floral Skirt,
  with gender and an optional photo.
- **Item:** one physical garment, with size, gender, condition, optional photo,
  RFID tag ID and description.
- **Kit:** an outfit definition naming the required products, such as a particular
  skirt plus particular shoes. A product and its physical items can appear in
  several kit definitions without duplicating inventory.

Create categories first, then products and items. Select the group before
choosing the related category/product or uploading an image. Related catalog
records must be in the same group. Use **Kits** to define outfits; on a phone,
open **More → Manage kits** and **More → Manage items** for editing.

Save waits for the operation to finish; the editor remains available after an
error so you can retry. Each record opens with its own values. If an older record
shows an unknown group, ask the subscription owner to verify and assign its group.

## 8. Browsing, filtering and grouping inventory

The desktop **Dashboard** initially shows items held by you. Clear the Holder
filter or choose **Clear filters** to browse more items. **Inventory** provides
the full inventory view. On a phone, use **My items** or **More → Browse inventory**.

- Search garments, people, kits or tags.
- Filter by **Group**, **Category**, **Product**, **Holder**, **Owner**, **Kit**
  and **Size**. Category narrows the product choices.
- **My items** sets the holder to you; **Available** sets the holder to Storage.
- Choose **No grouping**, **Group by owner**, **Group by kit**, or
  **Group by owner + kit**. Sort by product, owner, holder or size.
- On a phone, open **Filters** to access filtering, grouping and sorting.

Kit grouping shows garments matching a kit definition, including incomplete
outfits. An item may appear under several kits. Open a garment to view its details.

## 9. Requesting garments

You need an active role in the item's group, or subscription ownership, to request it.

1. Browse inventory and choose **Request** for a garment, **Request matching items**
   for the current filtered list, or **Request all** for a displayed group.
2. Review the confirmation list, including sizes and current holders, then click
   **Send requests**.
3. Follow progress in **Transfers → My requests and offers**.

Items already held by you or already requested by you are skipped. A bulk request
can contain at most 100 eligible items; narrow your filters for a larger list.
It requests the exact visible garments, including multiple sizes or several
pieces of the same product if they are in that list. It does not assemble one
complete outfit automatically. The **Kits** screen describes outfit requirements;
use the inventory's kit and size filters to choose the garments you need.

Alternatively, open an item and choose **Request Transfer** or
**Request from Storage**. The current holder or an authorized administrator must
approve before the holder changes.

Pending requests do not reserve garments. The first valid approval wins; other
pending requests for that garment are declined automatically. Use **Cancel** in
**My requests and offers** for requests you no longer need.

## 10. Offering, accepting and returning items

There are two request-based ways to move an item:

- Someone requests an item you hold: open **Transfers → Pending** and choose
  **Approve & Transfer** or **Decline**.
- You offer an item you hold or own: on its detail page, choose a recipient in
  **Transfer to...** and click **Send Transfer Offer**. On a phone, choose
  **Offer to another member**, select a recipient, then **Send offer**. The
  recipient must choose **Accept & Transfer** or **Decline** in Transfers.

Recipients must have an active role in the item's group, or be the subscription
owner. Joiners and members with roles only in other groups are not offered as
recipients. If someone is missing, ask the owner or relevant superadmin to check
their group role. If their access changes before acceptance, an administrator
may need to resolve the pending offer.

On a phone, the transfer buttons are **Approve transfer**, **Accept transfer**
and **Cancel request**.

The holder can choose **Return to storage** when the garment is returned.
Owners and authorized group admins/superadmins can change a holder directly.
Every completed holder change is recorded in **History** on desktop or
**Holder history** on a phone. An item's
long-term **Owner** can be changed separately and does not create a holder entry.

## 11. Item details and transfer status

Item details show photos, size, gender, condition, description, RFID tag,
current holder and long-term owner. Use **Comments** for notes and **History**
(**Holder history** on a phone) for dated holder changes and who initiated them. On a phone, administrators use
**Manage owner and holder** to edit those assignments.

In desktop **Transfers**, **Pending** contains requests you can approve;
**My requests and offers** tracks your outgoing requests; **History** shows closed
requests. On a phone, the equivalent views are **Pending**, **Outgoing** and
**History**. “Item assigned elsewhere” means another transfer won. For an
“Old request” message, cancel the request and create it again.

## 12. Members and role assignment

Open **Members** to see subscription members and their roles in each group.

- The owner or that group's superadmin can select `joiner`, `user`, `admin`,
  `superadmin` or **No role**. “No role” removes access to that group; it does not
  remove subscription membership.
- Give a new joiner an active role in the group where they will work. A role in
  one group does not grant management or request permissions in every group.
- Authorized admins/superadmins can edit member profiles; they cannot freely
  change every administrator's profile. Role dropdowns remain restricted to
  owners and superadmins.
- The subscription owner can choose **Remove** to remove a member from the
  organization after reassigning their items and resolving pending transfers.
- Keep at least one superadmin in each group. The subscription owner cannot be
  removed through member management.

## 13. Site administration

Site administrators open **Site administration** (`/site-admin`) from navigation
or directly. This is separate from an organization's **Administration** page.

To review a subscription request:

1. Open the **Subscription requests** tab. Pending requests are shown by default;
   use the status selector to view other decisions and **Refresh** to reload.
2. Choose **Review request**. Read the applicant's identity, organization,
   first group and required explanation.
3. Choose **Approve request**, then **Confirm approval**, to create the subscription,
   first group and owner membership. Or choose **Decline request**, enter a required
   reason visible to the applicant, then **Confirm decline**.
4. Use **View request** to inspect a completed decision. **Load more requests**
   appears when another page is available.

In the **Subscriptions** tab, choose **Manage** (desktop) or **Manage subscription**
(phone) to inspect groups and members. Edit **Subscription name** and choose
**Save name** to rename it. Use **Load more subscriptions** for further entries.
This screen does not offer subscription deletion, membership migration or
cross-organization costume management.

## 14. Using the app on a phone

Below 768px, the app uses a phone layout with **My items**, **Kits**, **Transfers**
and **Profile** in the bottom navigation. **More** contains inventory browsing,
administration, invitation copying and sign-out. Joiners without an active role
see Profile only. Catalog administration uses cards and full-screen editors.

Save drafts before refreshing the page, signing out, changing accounts or
resizing across the desktop/phone boundary. Background sign-in token refresh
preserves drafts, but a full page reload or layout switch can discard them.
The mobile web interface is separate from the planned native NFC scanner.

## 15. Common questions

- **“You need an invitation link”:** ask your organization's administrator for
  the link. Confirm that you signed in with the expected email.
- **Only Profile is available:** ask the owner or your group's superadmin to
  grant an active group role.
- **Subscription request pending:** return to `/register` and choose **Check status**.
  For a declined request, read the feedback and revise your explanation.
- **An action is unavailable or denied:** check your role in the item's group.
  Site administrator access alone does not grant costume-management access.
- **No suitable garment is available:** check the group, kit, size and holder
  filters, and ask the current holder or an administrator about a return.
  Storage means a garment is not currently checked out; it may still have
  competing pending requests.
- **Save fails:** correct any reported field errors or connection problem and
  retry. Your open editor retains its draft after a submission error.

## 16. Native NFC scanner

A companion native app for identifying garments by tapping their NFC tags is
planned and is not yet available. Entering an RFID tag ID in the web catalog
does not enable phone NFC scanning. Continue using the web app to manage items
and transfers.
