/**
 * SISTEC Central Digital Library - Student Transcript & Dossier Generator
 * Compiles certified academic library dossiers including student profile, reading metrics,
 * session counts, cross-department clearance logs, and institutional signatures.
 */

export const printStudentTranscript = ({ student, activityData }) => {
  const printWin = window.open('', '_blank', 'width=980,height=880');
  if (!printWin) return;

  const s = activityData?.student || student || {};
  const stats = activityData?.stats || {
    eBooksRead: 0,
    totalReadingSessions: 0,
    totalDownloads: 0,
    totalAccessRequests: 0,
    totalReadingMinutes: 0
  };

  const bookProgress = activityData?.bookProgress || [];
  const permissions = activityData?.permissions || [];
  const logs = activityData?.logs || [];

  const totalHours = Math.floor((stats.totalReadingMinutes || 0) / 60);
  const remainingMins = (stats.totalReadingMinutes || 0) % 60;
  const timeFormatted = totalHours > 0 ? `${totalHours}h ${remainingMins}m` : `${remainingMins || (stats.totalReadingSessions * 8)}m`;

  const studentFullName = s.full_name || s.fullName || 'Student';
  const studentRoll = s.roll_number || s.rollNumber || 'N/A';
  const studentBranch = s.branch_name || s.branchName || 'General Engineering';
  const studentYear = s.year ? (String(s.year).includes('Year') ? s.year : `${s.year} Year`) : '1st Year';
  const studentSem = s.semester ? (String(s.semester).includes('Sem') ? s.semester : `${s.semester} Semester`) : '1st Semester';
  const studentBt = s.bt_number || s.btNumber || 'N/A';
  const studentUsername = s.username || s.email || 'N/A';
  const studentStatus = (s.status || 'approved').toUpperCase();
  const studentRegDate = s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  const studentStanding = s.is_blocked === 1 ? 'RESTRICTED (BLOCKED)' : 'ACTIVE (GOOD STANDING)';
  const authMethod = (s.auth_provider || s.authProvider || 'Institutional Auth').toUpperCase();
  const transcriptId = `SIS-TR-${(s.id || 'DOC').slice(0, 8).toUpperCase()}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>SISTec Central Library - Official Dossier - ${studentFullName}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
            padding: 24px;
            color: #0f172a;
            line-height: 1.45;
            background: #fff;
            font-size: 11px;
          }
          .header-wrap {
            border-bottom: 2.5px solid #1e3a8a;
            padding-bottom: 14px;
            margin-bottom: 18px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .logo-title {
            font-size: 18px;
            font-weight: 800;
            color: #1e3a8a;
            letter-spacing: -0.01em;
          }
          .subtitle {
            font-size: 10.5px;
            color: #475569;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 3px;
          }
          .meta-top {
            text-align: right;
            font-size: 10.5px;
            color: #64748b;
            line-height: 1.35;
          }
          .meta-top strong { color: #0f172a; }
          .section-title {
            font-size: 11.5px;
            font-weight: 700;
            color: #1e3a8a;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            border-bottom: 1.5px solid #e2e8f0;
            padding-bottom: 4px;
            margin: 18px 0 10px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .profile-box {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 14px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px 14px;
            font-size: 11px;
          }
          .profile-box div strong {
            color: #475569;
            display: inline-block;
            margin-right: 4px;
          }
          .stat-cards {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            margin-bottom: 16px;
          }
          .stat-card {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px 8px;
            text-align: center;
            background: #fdfdfd;
          }
          .stat-val {
            font-size: 16px;
            font-weight: 800;
            color: #2563eb;
            line-height: 1.1;
            margin-bottom: 2px;
          }
          .stat-label {
            font-size: 9px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
            margin-bottom: 14px;
          }
          th {
            background: #f1f5f9;
            padding: 7px 10px;
            border: 1px solid #cbd5e1;
            text-align: left;
            font-weight: 700;
            color: #334155;
          }
          td {
            padding: 6px 10px;
            border: 1px solid #cbd5e1;
            vertical-align: top;
          }
          .badge {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .badge-approved { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .badge-pending { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
          .badge-rejected { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
          .footer-signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 36px;
            padding-top: 14px;
            border-top: 1px solid #cbd5e1;
          }
          .sig-box { text-align: center; }
          .sig-line {
            border-top: 1px dashed #94a3b8;
            width: 80%;
            margin: 38px auto 6px auto;
          }
          .footer-note {
            margin-top: 24px;
            text-align: center;
            font-size: 9.5px;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            padding-top: 8px;
          }
          @media print {
            body { padding: 0; }
            button { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="header-wrap">
          <div>
            <div class="logo-title">SAGAR INSTITUTE OF SCIENCE &amp; TECHNOLOGY (SISTec)</div>
            <div class="subtitle">Central Digital Library &bull; Official Student Dossier &amp; Activity Transcript</div>
          </div>
          <div class="meta-top">
            Transcript ID: <strong>${transcriptId}</strong><br />
            Generated: <strong>${new Date().toLocaleString('en-IN')}</strong><br />
            Account Status: <strong style="color: ${studentStatus === 'APPROVED' ? '#15803d' : '#b45309'}">${studentStatus}</strong>
          </div>
        </div>

        <!-- Section 1: Candidate Profile -->
        <div class="section-title">1. Candidate Institutional Identification</div>
        <div class="profile-box">
          <div><strong>Student Name:</strong> ${studentFullName}</div>
          <div><strong>Enrollment / Roll No:</strong> ${studentRoll}</div>
          <div><strong>BT Code / Card No:</strong> ${studentBt}</div>
          <div><strong>Assigned Department:</strong> ${studentBranch}</div>
          <div><strong>Academic Year / Sem:</strong> ${studentYear} &bull; ${studentSem}</div>
          <div><strong>Institutional Username:</strong> ${studentUsername}</div>
          <div><strong>Registration Date:</strong> ${studentRegDate}</div>
          <div><strong>Account Standing:</strong> ${studentStanding}</div>
          <div><strong>Auth Provider:</strong> ${authMethod}</div>
        </div>

        <!-- Section 2: Library Engagement Metrics -->
        <div class="section-title">2. Quantitative Engagement Metrics</div>
        <div class="stat-cards">
          <div class="stat-card">
            <div class="stat-val">${stats.eBooksRead || 0}</div>
            <div class="stat-label">E-Books Read</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${stats.totalReadingSessions || 0}</div>
            <div class="stat-label">Reading Sessions</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${timeFormatted}</div>
            <div class="stat-label">Estimated Time</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${stats.totalDownloads || 0}</div>
            <div class="stat-label">PDF Downloads</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${stats.totalAccessRequests || 0}</div>
            <div class="stat-label">Access Requests</div>
          </div>
        </div>

        <!-- Section 3: Digital Reading Engagement & History -->
        <div class="section-title">3. Digital Reading Portfolio &amp; Progress (${bookProgress.length} Titles)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 24px;">#</th>
              <th>Resource Title &amp; Author</th>
              <th>Department / Category</th>
              <th style="width: 80px;">Pages Read</th>
              <th style="width: 75px;">Sessions</th>
              <th style="width: 80px;">Downloaded</th>
              <th style="width: 125px;">Last Accessed</th>
            </tr>
          </thead>
          <tbody>
            ${bookProgress.length === 0
              ? '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 14px;">No digital library reading records logged for this candidate.</td></tr>'
              : bookProgress.map((item, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>
                    <strong>${item.book?.title || 'Academic Resource'}</strong>
                    ${item.book?.author ? `<br /><span style="color: #64748b; font-size: 9.5px;">By ${item.book.author}</span>` : ''}
                  </td>
                  <td>${item.book?.branch?.name || item.book?.branch_name || 'General'} &bull; ${item.book?.category?.name || 'Curriculum'}</td>
                  <td>Page ${item.last_page_read || 1}${item.total_pages ? ` / ${item.total_pages}` : ''}</td>
                  <td>${item.accessed_count || 1} session(s)</td>
                  <td>${(item.is_downloaded === 1 || item.downloaded_count > 0) ? '<span style="color: #15803d; font-weight: 700;">Yes</span>' : 'Online Only'}</td>
                  <td>${item.last_accessed_at ? new Date(item.last_accessed_at).toLocaleString('en-IN') : 'N/A'}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>

        <!-- Section 4: Resource Access Clearance & Permission Requests -->
        <div class="section-title">4. Inter-Departmental Resource Clearance History (${permissions.length} Records)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 24px;">#</th>
              <th>Requested Resource Title</th>
              <th>Target Department</th>
              <th style="width: 130px;">Request Timestamp</th>
              <th style="width: 95px;">Clearance Status</th>
            </tr>
          </thead>
          <tbody>
            ${permissions.length === 0
              ? '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 12px;">No special resource access requests on record.</td></tr>'
              : permissions.map((p, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${p.book?.title || p.book_title || 'General Department Catalog'}</strong></td>
                  <td>${p.branch?.name || p.requested_branch_name || p.branch_name || 'Department'}</td>
                  <td>${p.created_at ? new Date(p.created_at).toLocaleString('en-IN') : 'N/A'}</td>
                  <td>
                    <span class="badge badge-${p.status || 'pending'}">
                      ${(p.status || 'PENDING').toUpperCase()}
                    </span>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>

        <!-- Section 5: Activity Audit Log -->
        <div class="section-title">5. Institutional Security &amp; Activity Log (Last ${Math.min(logs.length, 30)} Events)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 24px;">#</th>
              <th style="width: 95px;">Event Type</th>
              <th>Activity Description</th>
              <th style="width: 140px;">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0
              ? '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 12px;">No activity events recorded.</td></tr>'
              : logs.slice(0, 30).map((l, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong style="text-transform: capitalize; color: #334155;">${l.action_type || 'Event'}</strong></td>
                  <td>
                    ${l.details || l.action_type}
                    ${l.book?.title ? ` &mdash; <span style="color: #64748b;">(${l.book.title})</span>` : ''}
                  </td>
                  <td>${l.created_at ? new Date(l.created_at).toLocaleString('en-IN') : 'N/A'}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>

        <!-- Section 6: Official Signatures -->
        <div class="footer-signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Head of Digital Library Services</strong><br />
            <span style="font-size: 10px; color: #64748b;">Central Library, SISTec Campus</span>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Dean of Academic &amp; Student Affairs</strong><br />
            <span style="font-size: 10px; color: #64748b;">Sagar Institute of Science &amp; Technology</span>
          </div>
        </div>

        <div class="footer-note">
          This document is a certified computer-generated academic dossier issued by the SISTec Central Digital Library Portal. Authenticated via Database UUID: ${s.id || 'N/A'}
        </div>
      </body>
    </html>
  `;

  printWin.document.write(htmlContent);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => { printWin.print(); }, 400);
};
