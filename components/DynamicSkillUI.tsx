'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  Column,
  TextInput,
  TextArea,
  Button,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  Tag,
  Checkbox,
  Select,
  SelectItem,
  NumberInput,
  Accordion,
  AccordionItem,
  InlineNotification,
  Pagination,
  Toggle,
  DatePicker,
  DatePickerInput,
  MultiSelect,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  ClickableTile,
  Stack,
  ContainedList,
  ContainedListItem,
  CodeSnippet,
} from '@carbon/react';
import { Search, Download, View, Table as TableIcon, List, Grid as GridIcon } from '@carbon/icons-react';

interface SkillUIConfig {
  id: string;
  name: string;
  description: string;
  layout?: 'simple' | 'tabs' | 'sections';
  sections?: Array<{
    id: string;
    title: string;
    inputs: string[]; // IDs of inputs in this section
  }>;
  tabs?: Array<{
    id: string;
    label: string;
    inputs: string[]; // IDs of inputs in this tab
  }>;
  inputs: Array<{
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'date' | 'toggle' | 'checkbox';
    placeholder?: string;
    required?: boolean;
    min?: number;
    max?: number;
    step?: number;
    default?: any;
    helperText?: string;
    options?: Array<{ value: string; text: string }>;
  }>;
  api: {
    url: string;
    method: string;
    bodyMapping: Record<string, string>;
  };
  outputs: {
    type: 'table' | 'cards' | 'list' | 'accordion' | 'json';
    rootPath?: string;
    columns?: Array<{
      key: string;
      header: string;
      type?: 'tag' | 'linkOrTag' | 'text' | 'code' | 'image';
      tagType?: 'rating' | 'status' | 'default' | 'blue' | 'green' | 'red' | 'gray';
    }>;
    card?: {
      titleKey: string;
      descriptionKey: string;
      metaKey?: string;
      tagKey?: string;
    };
    list?: {
      titleKey: string;
      descriptionKey: string;
    };
  };
  filters?: Array<{
    id: string;
    label: string;
    type: 'checkbox' | 'select' | 'number';
    field?: string;
    options?: Array<{ value: string; text: string }>;
  }>;
}

interface DynamicSkillUIProps {
  skillId: string;
}

export function DynamicSkillUI({ skillId }: DynamicSkillUIProps) {
  const [config, setConfig] = useState<SkillUIConfig | null>(null);
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [results, setResults] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  // Filter states
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`/api/skills/${skillId}`);
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
          
          // Initialize inputs with defaults
          const initialInputs: Record<string, any> = {};
          data.inputs?.forEach((input: any) => {
            initialInputs[input.id] = input.default ?? (input.type === 'toggle' || input.type === 'checkbox' ? false : '');
          });
          setInputs(initialInputs);
        } else {
            setError(`Failed to load skill configuration for ${skillId}`);
        }
      } catch (err) {
        setError('Error loading skill configuration');
      }
    };

    loadConfig();
    // Reset state when skill changes
    setResults([]);
    setError(null);
    setStatus('');
  }, [skillId]);

  const handleInputChange = (id: string, value: any) => {
    setInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleFilterChange = (id: string, value: any) => {
    setFilterValues(prev => ({ ...prev, [id]: value }));
    setCurrentPage(1);
  };

  const handleExecute = async () => {
    if (!config) return;
    setIsProcessing(true);
    setError(null);
    setStatus('Executing skill...');

    try {
      // Map inputs to body
      const body: Record<string, any> = {};
      Object.entries(config.api.bodyMapping).forEach(([key, value]) => {
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
          const inputId = value.slice(2, -2);
          body[key] = inputs[inputId];
        } else {
          body[key] = value;
        }
      });

      const response = await fetch(config.api.url, {
        method: config.api.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Execution failed');
      }

      const resultsData = config.outputs.rootPath ? data[config.outputs.rootPath] : data;
      setResults(Array.isArray(resultsData) ? resultsData : [resultsData]);
      setStatus(`Success! Found ${Array.isArray(resultsData) ? resultsData.length : 1} items.`);
      
      // Track usage
      await fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          params: inputs,
          resultCount: Array.isArray(resultsData) ? resultsData.length : 1,
          timestamp: new Date().toISOString()
        })
      });

      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('');
    } finally {
      setIsProcessing(false);
    }
  };

  const getFilteredResults = useCallback(() => {
    if (!config || results.length === 0) return [];
    
    return results.filter(item => {
      if (!config.filters) return true;
      for (const filter of config.filters) {
        const val = filterValues[filter.id];
        if (val === undefined || val === null || val === 'all' || val === false) continue;
        
        const itemVal = item[filter.field || filter.id];
        
        if (filter.type === 'checkbox' && !itemVal) return false;
        if (filter.type === 'select') {
            if (filter.id === 'ratingCondition') {
                if (val === 'good' && itemVal < 4.0) return false;
                if (val === 'bad' && itemVal >= 4.0) return false;
            } else if (itemVal != val) {
                return false;
            }
        }
      }
      return true;
    });
  }, [config, results, filterValues]);

  if (!config) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineNotification kind="info" title="Loading" subtitle={`Initializing skill engine for ${skillId}...`} hideCloseButton />
      </div>
    );
  }

  const filteredResults = getFilteredResults();
  const paginatedResults = filteredResults.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderInput = (input: SkillUIConfig['inputs'][number]) => {
    switch (input.type) {
      case 'text':
        return (
          <TextInput
            id={input.id}
            labelText={input.label}
            placeholder={input.placeholder}
            value={inputs[input.id] || ''}
            onChange={(e) => handleInputChange(input.id, e.target.value)}
          />
        );
      case 'textarea':
        return (
          <TextArea
            id={input.id}
            labelText={input.label}
            placeholder={input.placeholder}
            value={inputs[input.id] || ''}
            onChange={(e) => handleInputChange(input.id, e.target.value)}
          />
        );
      case 'number':
        return (
          <NumberInput
            id={input.id}
            label={input.label}
            min={input.min}
            max={input.max}
            step={input.step}
            value={inputs[input.id] || 0}
            onChange={(_, { value }) => handleInputChange(input.id, value)}
            helperText={input.helperText}
          />
        );
      case 'select':
        return (
          <Select
            id={input.id}
            labelText={input.label}
            value={inputs[input.id] || ''}
            onChange={(e) => handleInputChange(input.id, e.target.value)}
          >
            {input.options?.map(opt => <SelectItem key={opt.value} value={opt.value} text={opt.text} />)}
          </Select>
        );
      case 'multiselect':
        return (
          <MultiSelect
            id={input.id}
            label={input.label}
            titleText={input.label}
            items={input.options || []}
            itemToString={(item: any) => item ? item.text : ''}
            initialSelectedItems={[]}
            onChange={(e) => handleInputChange(input.id, e.selectedItems)}
          />
        );
      case 'toggle':
        return (
          <Toggle
            id={input.id}
            labelText={input.label}
            toggled={!!inputs[input.id]}
            onToggle={(val) => handleInputChange(input.id, val)}
          />
        );
      case 'checkbox':
        return (
          <Checkbox
            id={input.id}
            labelText={input.label}
            checked={!!inputs[input.id]}
            onChange={(e) => handleInputChange(input.id, e.target.checked)}
          />
        );
      case 'date':
        return (
          <DatePicker datePickerType="single" onChange={(dates) => handleInputChange(input.id, dates[0])}>
            <DatePickerInput id={input.id} placeholder="mm/dd/yyyy" labelText={input.label} size="md" />
          </DatePicker>
        );
      default:
        return null;
    }
  };

  const renderCell = (row: any, col: any) => {
    const value = row[col.key];
    if (col.type === 'tag') {
        let tagType: any = col.tagType || 'default';
        if (col.tagType === 'rating') tagType = value >= 4 ? 'green' : value >= 3 ? 'gray' : 'red';
        return <Tag type={tagType}>{typeof value === 'number' ? value.toFixed(1) : value}</Tag>;
    }
    if (col.type === 'linkOrTag') {
        if (row.hasInstagram) return <Tag type="blue">Instagram</Tag>;
        if (value) return <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cds-link-primary)' }}>Visit</a>;
        return <Tag type="gray">None</Tag>;
    }
    if (col.type === 'code') {
        return <CodeSnippet type="inline">{JSON.stringify(value)}</CodeSnippet>;
    }
    return value?.toString() || '';
  };

  const renderOutput = () => {
    if (results.length === 0) return null;

    switch (config.outputs.type) {
      case 'table':
        return (
          <Column lg={16}>
            <DataTable rows={paginatedResults.map((r, i) => ({ ...r, id: r.id || i.toString() }))} headers={config.outputs.columns || []}>
              {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
                <TableContainer title="Results" description={`Found ${filteredResults.length} items`}>
                  <TableToolbar>
                    <TableToolbarContent>
                      <Button renderIcon={Download} kind="ghost" size="sm">Export</Button>
                    </TableToolbarContent>
                  </TableToolbar>
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => {
                          const { key, ...hp } = getHeaderProps({ header });
                          return <TableHeader key={key} {...hp}>{header.header}</TableHeader>;
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row, i) => {
                        const { key, ...rp } = getRowProps({ row });
                        return (
                          <TableRow key={key} {...rp}>
                            {row.cells.map((cell, j) => (
                              <TableCell key={cell.id}>{renderCell(paginatedResults[i], config.outputs.columns![j])}</TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
            <Pagination
              backwardText="Previous"
              forwardText="Next"
              pageSize={pageSize}
              page={currentPage}
              pageSizes={[10, 20, 50, 100]}
              totalItems={filteredResults.length}
              onChange={({ page, pageSize }) => { setCurrentPage(page); setPageSize(pageSize); }}
            />
          </Column>
        );
      case 'cards':
        return (
          <Column lg={16}>
            <Grid narrow>
              {paginatedResults.map((item, i) => (
                <Column key={i} lg={4} md={4} sm={4}>
                  <ClickableTile style={{ height: '100%' }}>
                    <Stack gap={3}>
                      <h4 style={{ fontWeight: 600 }}>{item[config.outputs.card?.titleKey || 'name']}</h4>
                      <p>{item[config.outputs.card?.descriptionKey || 'description']}</p>
                      {config.outputs.card?.tagKey && <Tag type="blue">{item[config.outputs.card.tagKey]}</Tag>}
                    </Stack>
                  </ClickableTile>
                </Column>
              ))}
            </Grid>
          </Column>
        );
      case 'accordion':
        return (
          <Column lg={16}>
            <Accordion>
              {paginatedResults.map((item, i) => (
                <AccordionItem key={i} title={item[config.outputs.list?.titleKey || 'name']}>
                  <div style={{ padding: '1rem' }}>
                    <p>{item[config.outputs.list?.descriptionKey || 'description']}</p>
                    <CodeSnippet type="multi">{JSON.stringify(item, null, 2)}</CodeSnippet>
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          </Column>
        );
      default:
        return <Column lg={16}><CodeSnippet type="multi">{JSON.stringify(results, null, 2)}</CodeSnippet></Column>;
    }
  };

  return (
    <div className="dynamic-skill-ui" style={{ padding: '2rem' }}>
      <Grid>
        <Column lg={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
            <div>
                <h1 className="page-title">{config.name}</h1>
                <p className="page-description">{config.description}</p>
            </div>
          </div>
        </Column>

        <Column lg={16} className="inputs-section" style={{ marginBottom: '2rem' }}>
            {config.layout === 'tabs' ? (
                <Tabs>
                    <TabList aria-label="Input tabs">
                        {config.tabs?.map(tab => <Tab key={tab.id}>{tab.label}</Tab>)}
                    </TabList>
                    <TabPanels>
                        {config.tabs?.map(tab => (
                            <TabPanel key={tab.id}>
                                <Grid condensed>
                                    {tab.inputs.map(inputId => {
                                        const input = config.inputs.find(i => i.id === inputId);
                                        return input ? (
                                            <Column key={input.id} lg={4} md={4} sm={4} style={{ marginBottom: '1rem' }}>
                                                {renderInput(input)}
                                            </Column>
                                        ) : null;
                                    })}
                                </Grid>
                            </TabPanel>
                        ))}
                    </TabPanels>
                </Tabs>
            ) : config.layout === 'sections' ? (
                <Stack gap={6}>
                    {config.sections?.map(section => (
                        <div key={section.id}>
                            <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--cds-border-subtle)', paddingBottom: '0.5rem' }}>{section.title}</h4>
                            <Grid condensed>
                                {section.inputs.map(inputId => {
                                    const input = config.inputs.find(i => i.id === inputId);
                                    return input ? (
                                        <Column key={input.id} lg={4} md={4} sm={4} style={{ marginBottom: '1rem' }}>
                                            {renderInput(input)}
                                        </Column>
                                    ) : null;
                                })}
                            </Grid>
                        </div>
                    ))}
                </Stack>
            ) : (
                <Grid condensed>
                    {config.inputs.map(input => (
                        <Column key={input.id} lg={4} md={4} sm={4} style={{ marginBottom: '1rem' }}>
                            {renderInput(input)}
                        </Column>
                    ))}
                </Grid>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                <Button onClick={handleExecute} renderIcon={Search} disabled={isProcessing}>
                    {isProcessing ? 'Processing...' : 'Execute Skill'}
                </Button>
            </div>
        </Column>

        {status && <Column lg={16}><InlineNotification kind="info" title="Status" subtitle={status} hideCloseButton lowContrast /></Column>}
        {error && <Column lg={16}><InlineNotification kind="error" title="Error" subtitle={error} onClose={() => setError(null)} lowContrast /></Column>}

        {results.length > 0 && (
            <>
                <Column lg={16} style={{ marginTop: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3>Output</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                             {/* View Switchers if multiple types allowed could go here */}
                        </div>
                    </div>
                </Column>
                {renderOutput()}
            </>
        )}
      </Grid>
    </div>
  );
}
