-- Lab 模板统一镜像暴露端口配置
-- 执行前请先确认数据库已备份，并先执行 20260424_lab_app_ports.sql。

ALTER TABLE `lab_templates`
  ADD COLUMN `exposed_ports` JSON NULL AFTER `default_app_port_name`;

UPDATE `lab_templates` lt
LEFT JOIN (
  SELECT source.id,
    JSON_ARRAYAGG(
        JSON_OBJECT(
          'type', 'web',
          'name', JSON_UNQUOTE(JSON_EXTRACT(port_item.port_json, '$.name')),
          'label', JSON_UNQUOTE(JSON_EXTRACT(port_item.port_json, '$.label')),
          'containerPort', CAST(JSON_UNQUOTE(JSON_EXTRACT(port_item.port_json, '$.containerPort')) AS UNSIGNED),
          'path', COALESCE(JSON_UNQUOTE(JSON_EXTRACT(port_item.port_json, '$.path')), '/'),
          'isDefault', JSON_UNQUOTE(JSON_EXTRACT(port_item.port_json, '$.name')) = source.`default_app_port_name`
        ) ORDER BY port_item.port_order
    ) AS web_ports
  FROM `lab_templates` source
  JOIN JSON_TABLE(
    COALESCE(source.`app_ports`, JSON_ARRAY()),
    '$[*]' COLUMNS (
      port_order FOR ORDINALITY,
      port_json JSON PATH '$'
    )
  ) AS port_item
  GROUP BY source.id
) AS migrated_web ON migrated_web.id = lt.id
SET lt.`exposed_ports` = CASE
  WHEN lt.`desktop_enabled` = 1 THEN JSON_ARRAY_INSERT(
    COALESCE(migrated_web.web_ports, JSON_ARRAY()),
    '$[0]',
    JSON_OBJECT(
      'type', 'novnc',
      'name', 'novnc',
      'label', 'Desktop',
      'containerPort', 6080,
      'path', '',
      'isDefault', FALSE
    )
  )
  ELSE COALESCE(migrated_web.web_ports, JSON_ARRAY())
END
WHERE lt.`desktop_enabled` = 1 OR JSON_LENGTH(COALESCE(lt.`app_ports`, JSON_ARRAY())) > 0;
