'use client';

import { useState, useEffect } from 'react';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Toggle,
  Button,
  Tag,
  Modal,
  TextInput,
  TextArea,
  Select,
  SelectItem,
  InlineLoading,
} from '@carbon/react';
import { Edit } from '@carbon/icons-react';

interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  hidden: boolean;
}

interface SkillsManagementProps {
  onSkillsChanged?: () => void;
}

const ICON_OPTIONS = [
  'Activity', 'Location', 'Search', 'Analytics', 'Chat',
  'Document', 'Email', 'Favorite', 'Globe', 'Settings',
  'Star', 'Tag', 'Terminal', 'Tools', 'User',
];

export function SkillsManagement({ onSkillsChanged }: SkillsManagementProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editSkill, setEditSkill] = useState<Skill | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', icon: '' });

  const fetchSkills = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/skills');
      if (response.ok) {
        const data = await response.json();
        setSkills(data);
      }
    } catch (error) {
      console.error('Failed to fetch skills', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleToggleVisibility = async (skillId: string, currentHidden: boolean) => {
    try {
      const res = await fetch('/api/skills/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, hidden: !currentHidden }),
      });
      if (res.ok) {
        setSkills(prev =>
          prev.map(s => s.id === skillId ? { ...s, hidden: !currentHidden } : s)
        );
        onSkillsChanged?.();
      }
    } catch (error) {
      console.error('Failed to toggle skill visibility', error);
    }
  };

  const openEditModal = (skill: Skill) => {
    setEditSkill(skill);
    setEditForm({
      name: skill.name,
      description: skill.description,
      icon: skill.icon,
    });
  };

  const handleSaveEdit = async () => {
    if (!editSkill) return;
    try {
      const res = await fetch('/api/skills/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: editSkill.id,
          name: editForm.name,
          description: editForm.description,
          icon: editForm.icon,
        }),
      });
      if (res.ok) {
        setSkills(prev =>
          prev.map(s => s.id === editSkill.id ? {
            ...s,
            name: editForm.name,
            description: editForm.description,
            icon: editForm.icon,
          } : s)
        );
        onSkillsChanged?.();
        setEditSkill(null);
      }
    } catch (error) {
      console.error('Failed to update skill', error);
    }
  };

  const headers = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description' },
    { key: 'icon', header: 'Icon' },
    { key: 'status', header: 'Status' },
    { key: 'actions', header: 'Actions' },
  ];

  const rows = skills.map(skill => ({
    id: skill.id,
    name: skill.name,
    description: skill.description || '—',
    icon: skill.icon,
    status: skill.hidden ? 'hidden' : 'active',
    actions: skill.id,
  }));

  if (isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading skills..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Manage Skills</h1>
        <p>Configure visibility and settings for your installed skills.</p>
      </div>

      <DataTable rows={rows} headers={headers}>
        {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
          <Table {...getTableProps()}>
            <TableHead>
              <TableRow>
                {tableHeaders.map((header) => (
                  <TableHeader {...getHeaderProps({ header })} key={header.key}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows.map((row) => {
                const skill = skills.find(s => s.id === row.id)!;
                return (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map((cell) => {
                      if (cell.info.header === 'status') {
                        return (
                          <TableCell key={cell.id}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Toggle
                                id={`toggle-${row.id}`}
                                size="sm"
                                toggled={!skill.hidden}
                                onToggle={() => handleToggleVisibility(skill.id, skill.hidden)}
                                labelA="Hidden"
                                labelB="Active"
                                hideLabel
                              />
                              <Tag type={skill.hidden ? 'cool-gray' : 'green'} size="sm">
                                {skill.hidden ? 'Hidden' : 'Active'}
                              </Tag>
                            </div>
                          </TableCell>
                        );
                      }
                      if (cell.info.header === 'actions') {
                        return (
                          <TableCell key={cell.id}>
                            <Button
                              hasIconOnly
                              renderIcon={Edit}
                              iconDescription="Edit skill"
                              kind="ghost"
                              size="sm"
                              onClick={() => openEditModal(skill)}
                            />
                          </TableCell>
                        );
                      }
                      if (cell.info.header === 'icon') {
                        return (
                          <TableCell key={cell.id}>
                            <Tag type="blue" size="sm">{cell.value}</Tag>
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DataTable>

      <Modal
        open={editSkill !== null}
        modalHeading={`Edit Skill: ${editSkill?.id || ''}`}
        primaryButtonText="Save"
        secondaryButtonText="Cancel"
        onRequestClose={() => setEditSkill(null)}
        onRequestSubmit={handleSaveEdit}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <TextInput
            id="edit-skill-name"
            labelText="Display Name"
            value={editForm.name}
            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
          />
          <TextArea
            id="edit-skill-description"
            labelText="Description"
            value={editForm.description}
            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
          />
          <Select
            id="edit-skill-icon"
            labelText="Icon"
            value={editForm.icon}
            onChange={(e) => setEditForm(prev => ({ ...prev, icon: e.target.value }))}
          >
            {ICON_OPTIONS.map(icon => (
              <SelectItem key={icon} value={icon} text={icon} />
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
}
